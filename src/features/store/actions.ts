"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 소상공인 행사 참가 데이터 플랫폼: 가게/상품 관리 서버 액션.
// 61번 항목(보안): DB 쓰기는 전부 서버 액션 안에서, RLS 정책과 이중으로 소유자 검증.
// 주의: "use server" 파일은 async 함수만 export 가능 — 상수는 ./constants.ts로 분리.

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = value ? String(value).trim() : "";
  return s.length ? s : null;
}

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function createStore(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!name || !category) {
    redirect(`/store?error=${encodeURIComponent("가게 이름과 카테고리는 필수입니다.")}`);
  }

  const { error } = await supabase.from("stores").insert({
    owner_id: user.id,
    name,
    category,
    nickname: emptyToNull(formData.get("nickname")),
    flagship_product: emptyToNull(formData.get("flagship_product")),
    active_region: emptyToNull(formData.get("active_region")),
    contact: emptyToNull(formData.get("contact")),
    email: emptyToNull(formData.get("email")),
  });

  if (error) {
    redirect(`/store?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/store");
  redirect("/store");
}

export async function updateStore(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const storeId = String(formData.get("store_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!storeId || !name || !category) {
    redirect(`/store?error=${encodeURIComponent("가게 이름과 카테고리는 필수입니다.")}`);
  }

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      category,
      nickname: emptyToNull(formData.get("nickname")),
      flagship_product: emptyToNull(formData.get("flagship_product")),
      active_region: emptyToNull(formData.get("active_region")),
      contact: emptyToNull(formData.get("contact")),
      email: emptyToNull(formData.get("email")),
    })
    .eq("id", storeId)
    .eq("owner_id", user.id); // RLS로도 막히지만 서버 액션에서 한 번 더 명시적으로 소유자 검증

  if (error) {
    redirect(`/store?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/store");
  redirect("/store");
}

export async function addProduct(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const storeId = String(formData.get("store_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!storeId || !name) {
    redirect(`/store?error=${encodeURIComponent("상품명을 입력해 주세요.")}`);
  }

  const { error } = await supabase.from("products").insert({
    store_id: storeId,
    name,
    category: emptyToNull(formData.get("category")),
    price: toNumberOrNull(formData.get("price")),
    cost: toNumberOrNull(formData.get("cost")),
    description: emptyToNull(formData.get("description")),
  });

  if (error) {
    redirect(`/store?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/store");
  redirect("/store");
}

export async function deleteProduct(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const productId = String(formData.get("product_id") ?? "");
  if (!productId) redirect("/store");

  // RLS 정책("own products")이 소유자 아닌 삭제를 어차피 막지만, 쿼리 자체도 안전하게 유지.
  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    redirect(`/store?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/store");
  redirect("/store");
}
