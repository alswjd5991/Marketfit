import assert from "node:assert/strict";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { generateChatReply } from "../src/features/ai/reply";
import { parseMarketfitEvents, type EventQuery, type MarketfitEventRow } from "../src/features/ai/event-search";

// 실제 채팅과 같은 진입점으로 Marketfit DB → 서울시/TourAPI 순서를 확인한다.
// DB 수정이나 Gemini 사용량은 발생하지 않는다(웹 검색 보충 단계는 키를 비워 건너뛴다).
config({ path: ".env.local", quiet: true });
delete process.env.GEMINI_API_KEY;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
async function marketfitEvents(query: EventQuery) {
  let request = supabase.from("events")
    .select("id, name, venue, event_type, start_date, end_date, event_recruitments(recruit_end, fee, is_sample_data)")
    .not("start_date", "is", null).lte("start_date", query.to).limit(300);
  if (query.region !== "전국") request = request.eq("region", query.region);
  const { data, error } = await request;
  if (error) throw error;
  return parseMarketfitEvents((data ?? []) as MarketfitEventRow[], query);
}

async function main() {
  const deps = { storeContext: async () => null, marketfitEvents };
  for (const question of ["이번 달 서울에서 열리는 행사는?", "다음 달 제주 축제", "서울 셀러 모집 중인 곳"]) {
    const result = await generateChatReply([{ role: "user", text: question }], deps);
    assert.ok(result.ok, question);
    assert.ok(result.text.includes("Marketfit"), `${question}: Marketfit 결과가 먼저 나오지 않음`);
    console.log(`\n## ${question}\n${result.text}\n출처 ${result.sources.length}개`);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "행사 조회 검증 실패");
  process.exitCode = 1;
});
