"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyStore } from "@/features/store/data";
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

  // "내 행사" 목록 화면은 아직 Phase 3~4에서 구현 예정이라(ComingSoon),
  // 방금 한 행동에 대한 확인은 지금 있던 페이지에서 바로 보여준다.
  redirect(`${backTo}?notice=${encodeURIComponent("내 행사에 추가했어요.")}`);
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
