"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyStore } from "@/features/store/data";
import { findEventIdBySource } from "./data";

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
