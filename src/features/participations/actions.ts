"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyStore } from "@/features/store/data";
import { uploadVendorImage } from "@/features/store/actions";
import { findEventIdBySource } from "./data";
import { STATUS_ORDER } from "./status-labels";
import type { ParticipationStatus } from "@/types/database";

function detailPath(participationId: string) {
  return `/my-events/${participationId}`;
}

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNumberOrZero(value: FormDataEntryValue | null): number {
  return toNumberOrNull(value) ?? 0;
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = value ? String(value).trim() : "";
  return s.length ? s : null;
}

/** "" → null, "true"/"false" → boolean. 전기/차량 이용 가능 여부처럼 "잘 모름"이 있는 tri-state select용. */
function toBooleanOrNull(value: FormDataEntryValue | null): boolean | null {
  const s = value === null ? "" : String(value);
  if (s === "") return null;
  return s === "true";
}

/** select의 값이 정해진 두 값(BOOTH_PROVIDED_OPTIONS) 중 하나가 아니면 null로 — 폼 조작으로 이상한 문자열이 들어와도 DB엔 정해진 값만 저장. */
function toBoothProvided(value: FormDataEntryValue | null): "organizer" | "self" | null {
  const s = value === null ? "" : String(value);
  return s === "organizer" || s === "self" ? s : null;
}

/**
 * "내 행사에 추가" 버튼의 서버 액션.
 * 로그인 안 됨 → 로그인 페이지로, 가게 미등록 → 가게 등록 페이지로 보내
 * 버튼이 끝까지 "죽어있지" 않고 다음 할 일을 안내하도록 한다(65.7번 원칙).
 */
export async function addParticipation(formData: FormData) {
  const sourceDataset = String(formData.get("source_dataset") ?? "");
  const seedId = String(formData.get("seed_id") ?? "");
  const backTo = String(formData.get("back_to") ?? "/my-events");

  if (!sourceDataset || !seedId) redirect(backTo);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?notice=${encodeURIComponent("로그인 후 내 행사에 추가할 수 있어요.")}`);
  }

  const store = await getMyStore();
  if (!store) {
    redirect(`/store?notice=${encodeURIComponent("먼저 가게를 등록해야 행사에 참가 등록할 수 있어요.")}`);
  }

  const eventId = await findEventIdBySource(sourceDataset, seedId);
  if (!eventId) {
    redirect(
      `${backTo}?error=${encodeURIComponent(
        "아직 이 행사가 데이터베이스에 등록되지 않았어요. 잠시 후 다시 시도해 주세요."
      )}`
    );
  }

  // 이미 추가돼 있어도 에러 내지 않고 조용히 넘어간다(unique(store_id, event_id)).
  const { error } = await supabase
    .from("event_participations")
    .upsert(
      { store_id: store.id, event_id: eventId, status: "interested" },
      { onConflict: "store_id,event_id", ignoreDuplicates: true }
    );

  if (error) {
    redirect(`${backTo}?error=${encodeURIComponent(error.message)}`);
  }

  // 별도 알림 없이 원래 페이지로 — 버튼이 "내 행사에서 보기"로 바뀌는 것으로 충분하다.
  redirect(backTo);
}

/** 61번 항목: store_id 조건을 매 쿼리에 직접 걸어 RLS와 이중으로 소유자 검증. */
async function requireOwnedParticipation(participationId: string) {
  const supabase = await createClient();
  const store = await getMyStore();
  if (!store) redirect(`/store?notice=${encodeURIComponent("먼저 가게를 등록해 주세요.")}`);

  return { supabase, storeId: store!.id, participationId };
}

export async function updateParticipationStatus(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!participationId) redirect("/my-events");
  if (!STATUS_ORDER.includes(status as ParticipationStatus)) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent("올바르지 않은 상태값입니다.")}`);
  }

  const { supabase, storeId } = await requireOwnedParticipation(participationId);
  const { error } = await supabase
    .from("event_participations")
    .update({ status: status as ParticipationStatus })
    .eq("id", participationId)
    .eq("store_id", storeId);

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(`${detailPath(participationId)}?notice=${encodeURIComponent("상태를 변경했어요.")}`);
}

export async function updateParticipationPrep(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  if (!participationId) redirect("/my-events");

  const { supabase, storeId } = await requireOwnedParticipation(participationId);
  const { error } = await supabase
    .from("event_participations")
    .update({
      fee: toNumberOrNull(formData.get("fee")),
      expected_revenue: toNumberOrNull(formData.get("expected_revenue")),
      target_revenue: toNumberOrNull(formData.get("target_revenue")),
      // 2026-09-24 추가: 부스 로지스틱스(다른 마켓 신청서 조사 반영 — 0002 마이그레이션)
      booth_provided: toBoothProvided(formData.get("booth_provided")),
      booth_size: emptyToNull(formData.get("booth_size")),
      power_available: toBooleanOrNull(formData.get("power_available")),
      vehicle_access: toBooleanOrNull(formData.get("vehicle_access")),
    })
    .eq("id", participationId)
    .eq("store_id", storeId);

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(`${detailPath(participationId)}?notice=${encodeURIComponent("참가 전 정보를 저장했어요.")}`);
}

export async function updateParticipationResult(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  if (!participationId) redirect("/my-events");

  const { supabase, storeId } = await requireOwnedParticipation(participationId);

  // net_profit은 생성 컬럼이 아니라 앱 레벨에서 계산해 저장한다(스키마 주석 참고).
  const { data: current, error: fetchErr } = await supabase
    .from("event_participations")
    .select("fee")
    .eq("id", participationId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (fetchErr || !current) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(fetchErr?.message ?? "참가 기록을 찾을 수 없어요.")}`);
  }

  const totalRevenue = toNumberOrNull(formData.get("total_revenue"));
  const transportCost = toNumberOrZero(formData.get("transport_cost"));
  const parkingCost = toNumberOrZero(formData.get("parking_cost"));
  const lodgingCost = toNumberOrZero(formData.get("lodging_cost"));
  const otherCost = toNumberOrZero(formData.get("other_cost"));
  const fee = current!.fee ?? 0;

  const netProfit =
    totalRevenue == null ? null : totalRevenue - fee - transportCost - parkingCost - lodgingCost - otherCost;

  const wouldReattendRaw = formData.get("would_reattend");
  const wouldReattend = wouldReattendRaw === "" || wouldReattendRaw === null ? null : wouldReattendRaw === "true";

  // 부스 사진은 새로 고른 파일이 있을 때만 업로드하고, payload에도 그때만
  // logo_url 키를 넣는다(store/actions.ts의 updateStore와 같은 이유 —
  // 빈 file input을 그대로 반영하면 기존 사진이 지워진다).
  const user = await getCurrentUser();
  const { url: newBoothPhotoUrl, error: photoError } = user
    ? await uploadVendorImage(supabase, user.id, "booth-photo", formData.get("booth_photo"))
    : { url: null, error: null };
  if (photoError) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(photoError)}`);
  }

  const { error } = await supabase
    .from("event_participations")
    .update({
      total_revenue: totalRevenue,
      operating_hours: emptyToNull(formData.get("operating_hours")),
      transport_cost: transportCost,
      parking_cost: parkingCost,
      lodging_cost: lodgingCost,
      other_cost: otherCost,
      net_profit: netProfit,
      satisfaction: toNumberOrNull(formData.get("satisfaction")),
      weather: emptyToNull(formData.get("weather")),
      indoor_outdoor: emptyToNull(formData.get("indoor_outdoor")),
      perceived_crowd: emptyToNull(formData.get("perceived_crowd")),
      would_reattend: wouldReattend,
      memo: emptyToNull(formData.get("memo")),
      // 2026-09-24 추가: 참가 후 기록되는 부스 정보(다른 마켓 신청서 조사 반영 — 0002 마이그레이션)
      booth_number: emptyToNull(formData.get("booth_number")),
      booth_location_rating: toNumberOrNull(formData.get("booth_location_rating")),
      payment_methods_used: formData.getAll("payment_methods_used").length
        ? (formData.getAll("payment_methods_used") as string[])
        : null,
      ...(newBoothPhotoUrl ? { booth_photo_url: newBoothPhotoUrl } : {}),
    })
    .eq("id", participationId)
    .eq("store_id", storeId);

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(`${detailPath(participationId)}?notice=${encodeURIComponent("참가 결과를 저장했어요.")}`);
}

export async function addChecklistItem(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!participationId) redirect("/my-events");
  if (!label) redirect(`${detailPath(participationId)}?error=${encodeURIComponent("체크리스트 항목을 입력해 주세요.")}`);

  const { supabase } = await requireOwnedParticipation(participationId);
  // RLS(own checklists)가 participation_id 소유자 검증을 대신한다 — 남의
  // participation_id를 넣어도 insert가 거부된다.
  const { error } = await supabase.from("event_checklists").insert({
    participation_id: participationId,
    label,
    is_custom: true,
  });

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(detailPath(participationId));
}

export async function toggleChecklistItem(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  const checklistId = String(formData.get("checklist_id") ?? "");
  const nextChecked = String(formData.get("next_checked") ?? "") === "true";
  if (!participationId || !checklistId) redirect("/my-events");

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_checklists")
    .update({ checked: nextChecked })
    .eq("id", checklistId);

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(detailPath(participationId));
}

export async function deleteChecklistItem(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  const checklistId = String(formData.get("checklist_id") ?? "");
  if (!participationId || !checklistId) redirect("/my-events");

  const supabase = await createClient();
  const { error } = await supabase.from("event_checklists").delete().eq("id", checklistId);

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(detailPath(participationId));
}

/**
 * 상품별 판매 실적 한 줄 추가.
 * "내 상품" 목록에서 골랐으면(product_id) 그 상품의 이름/기본 단가를 가져와
 * 스냅샷으로 저장하고, 직접 입력(product_name_custom)이면 그 이름을 그대로
 * 쓴다 — event_product_sales.product_name은 상품이 나중에 삭제/변경돼도
 * 기록은 그대로 남도록 만든 스냅샷 컬럼(스키마 주석 참고).
 */
export async function addProductSale(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  if (!participationId) redirect("/my-events");

  const { supabase, storeId } = await requireOwnedParticipation(participationId);

  const productId = emptyToNull(formData.get("product_id"));
  const customName = String(formData.get("product_name_custom") ?? "").trim();
  let productName = customName;
  let price = toNumberOrNull(formData.get("price"));

  if (productId) {
    // 61번 항목: store_id까지 걸어 남의 상품 id를 넣어도 붙지 않도록 이중 확인.
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name, price")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (productError || !product) {
      redirect(`${detailPath(participationId)}?error=${encodeURIComponent("선택한 상품을 찾을 수 없어요.")}`);
    }
    productName = product!.name;
    if (price == null) price = product!.price;
  }

  if (!productName) {
    redirect(
      `${detailPath(participationId)}?error=${encodeURIComponent("상품을 선택하거나 상품명을 직접 입력해 주세요.")}`
    );
  }

  const { error } = await supabase.from("event_product_sales").insert({
    participation_id: participationId,
    product_id: productId,
    product_name: productName,
    prepared: toNumberOrZero(formData.get("prepared")),
    sold: toNumberOrZero(formData.get("sold")),
    price: price ?? 0,
  });

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(`${detailPath(participationId)}?notice=${encodeURIComponent("판매 실적을 추가했어요.")}`);
}

export async function updateProductSale(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  const saleId = String(formData.get("sale_id") ?? "");
  if (!participationId || !saleId) redirect("/my-events");

  const supabase = await createClient();
  // revenue/sell_through_rate는 생성 컬럼이라 payload에 넣으면 안 된다(스키마 주석 참고).
  const { error } = await supabase
    .from("event_product_sales")
    .update({
      prepared: toNumberOrZero(formData.get("prepared")),
      sold: toNumberOrZero(formData.get("sold")),
      price: toNumberOrZero(formData.get("price")),
    })
    .eq("id", saleId)
    .eq("participation_id", participationId);

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(`${detailPath(participationId)}?notice=${encodeURIComponent("판매 실적을 수정했어요.")}`);
}

export async function deleteProductSale(formData: FormData) {
  const participationId = String(formData.get("participation_id") ?? "");
  const saleId = String(formData.get("sale_id") ?? "");
  if (!participationId || !saleId) redirect("/my-events");

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_product_sales")
    .delete()
    .eq("id", saleId)
    .eq("participation_id", participationId);

  if (error) {
    redirect(`${detailPath(participationId)}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(detailPath(participationId));
  redirect(detailPath(participationId));
}
