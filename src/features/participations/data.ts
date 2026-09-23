import { createClient } from "@/lib/supabase/server";
import type { ParticipationStatus } from "@/types/database";
import { getMyStore } from "@/features/store/data";

/**
 * 정적 시드 데이터(src/lib/data/seed-events.ts)의 (sourceDataset, id)로
 * scripts/seed-events.ts가 적재해둔 실제 event_recruitments row를 찾아
 * DB의 event_id(uuid)를 반환한다.
 *
 * events 목록/상세 화면은 아직 정적 시드 파일을 그대로 읽고 있어서(빠르고
 * 이미 잘 동작함), "내 행사에 추가" 같은 쓰기 동작만 이 함수로 DB의 실제
 * 행 id를 찾아 연결한다 — events/data.ts 상단 주석에 적힌 대로, 화면을
 * 통째로 DB 조회로 바꾸는 건 다음 단계로 미뤄둔 의도적 절충이다.
 */
export async function findEventIdBySource(
  sourceDataset: string,
  seedId: string
): Promise<string | null> {
  const supabase = await createClient();
  const sourceKey = `${sourceDataset}:${seedId}`;
  try {
    const { data, error } = await supabase
      .from("event_recruitments")
      .select("event_id")
      .eq("source_post_id", sourceKey)
      .maybeSingle();
    if (error) throw error;
    return data?.event_id ?? null;
  } catch {
    return null; // 62번 항목: 네트워크 오류로 상세 페이지 전체가 죽지 않도록
  }
}

/**
 * 로그인 + 가게 등록 + (시딩 스크립트로) DB에 이 행사가 이미 올라와 있을
 * 때만 실제 참가 상태를 돌려준다. 셋 중 하나라도 아니면 null(아직 미참가로
 * 취급) — 버튼을 죽이지 않고 항상 시도 가능하게 하되, 상태 표시만 낙관적으로
 * "미추가"로 보여준다.
 */
export async function getMyParticipationStatus(
  sourceDataset: string,
  seedId: string
): Promise<ParticipationStatus | null> {
  const store = await getMyStore();
  if (!store) return null;

  const eventId = await findEventIdBySource(sourceDataset, seedId);
  if (!eventId) return null;

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("event_participations")
      .select("status")
      .eq("store_id", store.id)
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw error;
    return data?.status ?? null;
  } catch {
    return null;
  }
}
