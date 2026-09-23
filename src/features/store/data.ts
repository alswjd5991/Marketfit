import { createClient } from "@/lib/supabase/server";
import type { Product, Store } from "@/types/database";

/** 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록 방어(proxy.ts/nav-bar.tsx와 동일 패턴). */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/** 로그인한 사용자의 가게(현재는 1인 1가게 — MVP 범위) */
export async function getMyStore(): Promise<Store | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

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
