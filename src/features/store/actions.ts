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

/** "" → null, "true"/"false" → boolean. 위생교육 이수 여부처럼 "선택 안 함"이 있는 tri-state select용. */
function toBooleanOrNull(value: FormDataEntryValue | null): boolean | null {
  const s = value === null ? "" : String(value);
  if (s === "") return null;
  return s === "true";
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * 로고/부스 사진 업로드 공통 헬퍼. 파일이 선택 안 됐으면(빈 file input) 조용히
 * { url: null, error: null }을 돌려줘서 "기존 이미지 유지"로 처리할 수 있게 한다.
 * 61번 항목: 업로드 경로를 "{userId}/..."로 강제해 storage RLS(0002 마이그레이션)의
 * 소유자 검증과 일치시킨다 — 남의 폴더에 쓰려는 시도는 RLS가 어차피 막지만
 * 애초에 그런 경로를 만들지 않는다.
 */
// participations/actions.ts(부스 사진)에서도 재사용하므로 export한다.
export async function uploadVendorImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  folder: "store-logo" | "booth-photo",
  fileEntry: FormDataEntryValue | null
): Promise<{ url: string | null; error: string | null }> {
  if (!(fileEntry instanceof File) || fileEntry.size === 0) return { url: null, error: null };
  if (!fileEntry.type.startsWith("image/")) {
    return { url: null, error: "이미지 파일만 업로드할 수 있어요." };
  }
  if (fileEntry.size > MAX_IMAGE_BYTES) {
    return { url: null, error: "이미지 용량은 5MB 이하로 올려주세요." };
  }

  const ext = fileEntry.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("vendor-images").upload(path, fileEntry, {
    contentType: fileEntry.type,
    upsert: false,
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("vendor-images").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
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

  const { url: logoUrl, error: logoError } = await uploadVendorImage(
    supabase,
    user.id,
    "store-logo",
    formData.get("logo")
  );
  if (logoError) {
    redirect(`/store?error=${encodeURIComponent(logoError)}`);
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
    business_registration_number: emptyToNull(formData.get("business_registration_number")),
    sns_url: emptyToNull(formData.get("sns_url")),
    payment_methods: formData.getAll("payment_methods").length
      ? (formData.getAll("payment_methods") as string[])
      : null,
    hygiene_certified: toBooleanOrNull(formData.get("hygiene_certified")),
    logo_url: logoUrl,
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

  // 새 로고를 안 골랐으면(fileEntry 없음) logoUrl이 null로 돌아오는데, 이걸 그대로
  // update payload에 넣으면 기존 로고가 지워진다 — 그래서 업로드된 경우에만
  // logo_url 키를 payload에 포함시킨다(아래 spread).
  const { url: newLogoUrl, error: logoError } = await uploadVendorImage(
    supabase,
    user.id,
    "store-logo",
    formData.get("logo")
  );
  if (logoError) {
    redirect(`/store?error=${encodeURIComponent(logoError)}`);
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
      business_registration_number: emptyToNull(formData.get("business_registration_number")),
      sns_url: emptyToNull(formData.get("sns_url")),
      payment_methods: formData.getAll("payment_methods").length
        ? (formData.getAll("payment_methods") as string[])
        : null,
      hygiene_certified: toBooleanOrNull(formData.get("hygiene_certified")),
      ...(newLogoUrl ? { logo_url: newLogoUrl } : {}),
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

  const price = toNumberOrNull(formData.get("price"));
  if (price === null) {
    redirect(`/store?error=${encodeURIComponent("판매가를 입력해 주세요.")}`);
  }
  const cost = toNumberOrNull(formData.get("cost"));
  if (cost === null) {
    redirect(`/store?error=${encodeURIComponent("원가를 입력해 주세요.")}`);
  }

  const { error } = await supabase.from("products").insert({
    store_id: storeId,
    name,
    category: emptyToNull(formData.get("category")),
    price,
    cost,
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
