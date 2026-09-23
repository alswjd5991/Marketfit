// 실행: npm run seed:events
//
// src/lib/data/seed-events.ts에 있는 실제 행사 42건(6번 섹션 참고)을
// Supabase의 events / event_recruitments 테이블에 적재한다.
//
// 멱등 스크립트: event_recruitments.source_post_id에 `${sourceDataset}:${id}`
// 형태의 안정적인 키를 저장해두고, 이미 있으면 새로 만들지 않고 업데이트만
// 한다 — 여러 번 실행해도 중복이 쌓이지 않는다.
//
// events/event_recruitments는 RLS 정책상 공개 읽기만 허용하고 쓰기는 막혀
// 있어(supabase/migrations/0001_init.sql), anon/authenticated key로는 이
// 스크립트를 실행할 수 없다. .env.local에 SUPABASE_SERVICE_ROLE_KEY를
// 추가한 뒤(Supabase 대시보드 → Settings → API → service_role secret)
// 로컬에서만 실행할 것. 이 키는 이 스크립트 밖으로 절대 내보내지 않는다
// (클라이언트 코드에서 import 금지).

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { Database, SourceType } from "../src/types/database";
import { seedEvents, type SeedEvent } from "../src/lib/data/seed-events";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    [
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.",
      "Supabase 대시보드 → Settings → API → 'service_role' secret 키를 복사해",
      ".env.local에 아래 줄을 추가한 뒤 다시 실행하세요:",
      "  SUPABASE_SERVICE_ROLE_KEY=eyJ...",
    ].join("\n")
  );
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
});

function sourceKey(e: SeedEvent): string {
  return `${e.sourceDataset}:${e.id}`;
}

function mapSourceType(t: string | null): SourceType {
  if (!t) return "other";
  if (t.includes("원공고")) return "official_site"; // 주최 기관/학교의 자체 공고
  if (t.includes("플랫폼")) return "operator"; // 마켓 운영 플랫폼 게시글
  if (t.includes("재단")) return "foundation";
  if (t.includes("지자체") || t.includes("공공")) return "government";
  return "other"; // 언론기사, 포털요약 등 — 2차 출처
}

function toEventRow(e: SeedEvent): Database["public"]["Tables"]["events"]["Insert"] {
  return {
    name: e.name,
    region: e.region,
    venue: e.venue,
    category: e.category,
    event_type: e.series,
    start_date: e.startDate,
    end_date: e.endDate,
    description: e.items,
  };
}

function toRecruitmentRow(
  e: SeedEvent
): Omit<Database["public"]["Tables"]["event_recruitments"]["Insert"], "event_id"> {
  return {
    source_name: e.organizer ?? (e.sourceDataset === "seoul" ? "서울 소재 대학/기관" : "파일럿 수집"),
    source_url: e.sourceUrl ?? "",
    source_type: mapSourceType(e.sourceType),
    source_post_id: sourceKey(e),
    recruit_start: null,
    recruit_end: e.recruitEnd,
    fee: e.feeKrw,
    target: e.eligibility,
    conditions: e.items,
    how_to_apply: e.selection,
    organizer: e.organizer,
    is_sample_data: false, // 42건 전부 실제 공개 자료
  };
}

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const e of seedEvents) {
    const key = sourceKey(e);

    const { data: existing, error: findError } = await supabase
      .from("event_recruitments")
      .select("id, event_id")
      .eq("source_post_id", key)
      .maybeSingle();

    if (findError) {
      console.error(`[${key}] 조회 실패: ${findError.message}`);
      skipped++;
      continue;
    }

    if (existing) {
      const { error: eventErr } = await supabase
        .from("events")
        .update(toEventRow(e))
        .eq("id", existing.event_id);
      const { error: recruitErr } = await supabase
        .from("event_recruitments")
        .update(toRecruitmentRow(e))
        .eq("id", existing.id);

      if (eventErr || recruitErr) {
        console.error(`[${key}] 업데이트 실패: ${eventErr?.message ?? recruitErr?.message}`);
        skipped++;
        continue;
      }
      updated++;
      console.log(`[${key}] 업데이트: ${e.name}`);
      continue;
    }

    const { data: newEvent, error: insertEventErr } = await supabase
      .from("events")
      .insert(toEventRow(e))
      .select("id")
      .single();

    if (insertEventErr || !newEvent) {
      console.error(`[${key}] events insert 실패: ${insertEventErr?.message}`);
      skipped++;
      continue;
    }

    const { error: insertRecruitErr } = await supabase
      .from("event_recruitments")
      .insert({ ...toRecruitmentRow(e), event_id: newEvent.id });

    if (insertRecruitErr) {
      console.error(`[${key}] event_recruitments insert 실패: ${insertRecruitErr.message}`);
      // event는 이미 만들어졌는데 recruitment가 실패한 상태 — 다음 실행 때
      // source_post_id로 못 찾으므로 events row가 하나 남게 된다. 흔치 않은
      // 실패 케이스라 지금은 로그만 남기고 수동 정리하도록 한다.
      skipped++;
      continue;
    }

    created++;
    console.log(`[${key}] 생성: ${e.name}`);
  }

  console.log(
    `\n완료 — 생성 ${created}건 / 업데이트 ${updated}건 / 실패 ${skipped}건 (전체 ${seedEvents.length}건)`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
