// 실행: npm run sync:events            (실제 저장)
//       npm run sync:events -- --dry-run (수집·선별 결과만 출력, DB는 건드리지 않음)
//       npm run sync:events -- --from 2024-01-01 --to 2026-10-06   (그 기간에 열린 과거 행사를 한 달씩 나눠 수집)
//       npm run sync:events -- --prune [--dry-run]   (이미 저장된 자동 수집 행사 중 판매 부스를 낼 수 없는 행사 삭제)
//
// 매주 월요일 Vercel Cron(/api/cron/weekly-events)이 자동으로 하는 주간 행사 업데이트를
// 로컬에서 직접 한 번 돌린다. 로직은 src/features/events/weekly-sync.ts 하나를 같이 쓴다.
// 저장하려면 .env.local에 SUPABASE_SERVICE_ROLE_KEY, 전국 행사까지 받으려면 TOUR_API_KEY가 필요하다.
// 기간 수집(--from/--to)에 SEOUL_OPENAPI_KEY가 있으면 서울시 문화행사 정보(2021년 10월~)도 함께 모은다.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../src/lib/supabase/admin";
import { pruneNonSellerEvents, runWeeklyEventSync } from "../src/features/events/weekly-sync";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    const v = i >= 0 ? process.argv[i + 1] : undefined;
    if (v !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${name}는 YYYY-MM-DD 형식이어야 합니다: ${v}`);
    return v;
  };
  const [from, to] = [arg("--from"), arg("--to")];
  if (Boolean(from) !== Boolean(to)) throw new Error("--from과 --to는 함께 지정해야 합니다.");
  const supabase = createAdminClient();
  if (process.argv.includes("--prune")) {
    if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
    const r = await pruneNonSellerEvents(supabase, dryRun);
    console.log(`\n자동 수집 행사 ${r.checked}건 중 판매 부스를 낼 수 없는 행사 ${r.removed.length}건 ${dryRun ? "(삭제 예정, dry-run)" : "삭제"}`);
    for (const name of r.removed) console.log(`  - ${name}`);
    if (r.participations) console.log(`\n※ 이 행사들에 걸린 참가 기록 ${r.participations}건도 ${dryRun ? "함께 지워집니다" : "함께 지워졌습니다"}. 합성 셀러 데이터는 npm run seed:synthetic으로 다시 만드세요.`);
    return;
  }
  if (!dryRun && !supabase) {
    console.error("SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다. (--dry-run으로는 저장 없이 확인 가능)");
    process.exit(1);
  }

  const report = await runWeeklyEventSync({ supabase, dryRun, tourKey: process.env.TOUR_API_KEY?.trim(), seoulCultureKey: process.env.SEOUL_OPENAPI_KEY?.trim(), range: from && to ? { from, to } : undefined });

  console.log(`\n주간 행사 업데이트 ${dryRun ? "(dry-run)" : ""} — 대상 기간 ${report.range.from} ~ ${report.range.to}`);
  for (const s of report.sources) {
    console.log(`  · ${s.source}: ${s.error ? `실패(${s.error})` : `${s.fetched}건 중 셀러 참여형 ${s.kept}건`}`);
  }
  console.log(`  · 중복 제외 ${report.skippedAsDuplicate}건 → 저장 대상 ${report.candidates}건`);
  if (!dryRun) console.log(`  · 신규 ${report.created}건 / 갱신 ${report.updated}건 / 실패 ${report.failed}건 / 상세 정보 채움 ${report.detailed}건`);
  if (report.newEvents.length) {
    console.log(dryRun ? "\n저장 대상 예시:" : "\n이번 주 새로 추가된 행사:");
    for (const name of report.newEvents) console.log(`  - ${name}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
