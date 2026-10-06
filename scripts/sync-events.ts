// 실행: npm run sync:events            (실제 저장)
//       npm run sync:events -- --dry-run (수집·선별 결과만 출력, DB는 건드리지 않음)
//
// 매주 월요일 Vercel Cron(/api/cron/weekly-events)이 자동으로 하는 주간 행사 업데이트를
// 로컬에서 직접 한 번 돌린다. 로직은 src/features/events/weekly-sync.ts 하나를 같이 쓴다.
// 저장하려면 .env.local에 SUPABASE_SERVICE_ROLE_KEY, 전국 행사까지 받으려면 TOUR_API_KEY가 필요하다.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../src/lib/supabase/admin";
import { runWeeklyEventSync } from "../src/features/events/weekly-sync";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = createAdminClient();
  if (!dryRun && !supabase) {
    console.error("SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다. (--dry-run으로는 저장 없이 확인 가능)");
    process.exit(1);
  }

  const report = await runWeeklyEventSync({ supabase, dryRun, tourKey: process.env.TOUR_API_KEY?.trim() });

  console.log(`\n주간 행사 업데이트 ${dryRun ? "(dry-run)" : ""} — 대상 기간 ${report.range.from} ~ ${report.range.to}`);
  for (const s of report.sources) {
    console.log(`  · ${s.source}: ${s.error ? `실패(${s.error})` : `${s.fetched}건 중 셀러 참여형 ${s.kept}건`}`);
  }
  console.log(`  · 중복 제외 ${report.skippedAsDuplicate}건 → 저장 대상 ${report.candidates}건`);
  if (!dryRun) console.log(`  · 신규 ${report.created}건 / 갱신 ${report.updated}건 / 실패 ${report.failed}건`);
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
