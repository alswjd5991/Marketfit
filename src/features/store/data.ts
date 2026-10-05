import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Product, Store } from "@/types/database";

/**
 * 로그인 사용자. 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록 방어.
 * React cache로 한 요청 안에서는 한 번만 Supabase에 묻는다 — 메뉴바·페이지·데이터 함수가
 * 각자 부르면 요청마다 인증 왕복이 3~4번 생겨 화면 이동이 느려진다.
 */
export const getCurrentUser = cache(async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
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
