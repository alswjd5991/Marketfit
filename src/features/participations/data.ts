import { createClient } from "@/lib/supabase/server";
import type { ParticipationStatus } from "@/types/database";
import { getMyStore } from "@/features/store/data";

export interface MyParticipation {
  participationId: string;
  status: ParticipationStatus;
  eventId: string;
  eventName: string;
  region: string | null;
  venue: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  /** events/[id] 상세 페이지는 시드 id로 라우팅되므로, 링크를 만들 수 있을 때만 채운다. */
  detailSeedId: string | null;
}

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

/**
 * "내 행사" 목록. event_participations → events → event_recruitments 세
 * 테이블을 각각 조회해 JS에서 합친다(embedded select 대신). Database 타입에
 * Relationships 메타데이터를 채워두지 않아 postgrest-js의 임베드 select
 * 파서가 타입을 못 풀기 때문 — 대신 이 정도 규모에선 쿼리 3번이 더 단순하고
 * 안전하다.
 */
export async function getMyParticipations(): Promise<MyParticipation[]> {
  const store = await getMyStore();
  if (!store) return [];

  const supabase = await createClient();
  try {
    const { data: participations, error } = await supabase
      .from("event_participations")
      .select("id, status, event_id, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!participations || participations.length === 0) return [];

    const eventIds = participations.map((p) => p.event_id);

    const [{ data: events, error: eventsError }, { data: recruitments, error: recruitError }] =
      await Promise.all([
        supabase
          .from("events")
          .select("id, name, region, venue, category, start_date, end_date")
          .in("id", eventIds),
        supabase.from("event_recruitments").select("event_id, source_post_id").in("event_id", eventIds),
      ]);
    if (eventsError) throw eventsError;
    if (recruitError) throw recruitError;

    const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
    const seedIdMap = new Map<string, string>();
    for (const r of recruitments ?? []) {
      // source_post_id는 `${sourceDataset}:${seedId}` 형태(scripts/seed-events.ts 참고).
      if (!r.source_post_id) continue;
      const idx = r.source_post_id.indexOf(":");
      if (idx === -1) continue;
      seedIdMap.set(r.event_id, r.source_post_id.slice(idx + 1));
    }

    return participations.map((p) => {
      const e = eventMap.get(p.event_id);
      return {
        participationId: p.id,
        status: p.status,
        eventId: p.event_id,
        eventName: e?.name ?? "(정보를 찾을 수 없는 행사)",
        region: e?.region ?? null,
        venue: e?.venue ?? null,
        category: e?.category ?? null,
        startDate: e?.start_date ?? null,
        endDate: e?.end_date ?? null,
        detailSeedId: seedIdMap.get(p.event_id) ?? null,
      };
    });
  } catch {
    return []; // 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록
  }
}
