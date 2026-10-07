import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Product, Store } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string | undefined;
  user_metadata: Record<string, string | undefined>;
}

/**
 * 로그인 사용자. 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록 방어.
 * - getClaims: 이 프로젝트는 비대칭(ES256) 서명 키라 로그인 토큰을 공개 키로 서버에서 바로 검증한다.
 *   getUser처럼 페이지마다 Supabase 인증 서버에 묻지 않아 화면 이동이 빨라진다(키는 처음 한 번만 받아 둔다).
 *   예전 HS256 키였다면 라이브러리가 알아서 getUser로 확인한다.
 * - React cache: 메뉴바·페이지·데이터 함수가 각자 불러도 한 요청 안에서는 한 번만 확인한다.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    return {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      user_metadata: (claims.user_metadata ?? {}) as CurrentUser["user_metadata"],
    };
  } catch {
    return null;
  }
});

/** 로그인한 사용자의 가게(현재는 1인 1가게 — MVP 범위). 한 요청 안에서는 한 번만 조회한다. */
export const getMyStore = cache(async (): Promise<Store | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
});

export async function getMyProducts(storeId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
