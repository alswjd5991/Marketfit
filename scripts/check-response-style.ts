import { config } from "dotenv";
import { generateChatReply } from "../src/features/ai/reply";

// 수동 실행 전용: 실제 API를 호출하지만 사용자 DB를 읽거나 대화를 저장하지 않는다.
config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("AI 연결 키가 설정되지 않았어요.");
  const cases = [
    {
      question: "내 가게에서 순이익이 가장 높았던 행사를 짧게 알려줘.",
      context: "진단용 가상 기록이며 실제 사용자 데이터가 아닙니다. 계산된 통계: 2026년 9월 참가 행사 2건. 순이익 1위 테스트 가을마켓 70,000원(매출 100,000원, 비용 30,000원), 2위 테스트 주말마켓 40,000원. 원인에 대한 기록은 없습니다.",
    },
    {
      question: "내 가게의 지난달 매출이 줄어든 이유와 개선 방법을 알려줘.",
      context: "진단용 가상 기록이며 실제 사용자 데이터가 아닙니다. 가게는 등록되어 있지만 참가 기록, 상품별 판매 기록, 계산된 통계가 없습니다.",
    },
  ];
  for (const { question, context } of cases) {
    const result = await generateChatReply([{ role: "user", text: question }], {
      storeContext: async () => context,
      marketfitEvents: async () => [],
    });
    console.log(JSON.stringify({ question, ...result }, null, 2));
    if (!result.ok) { process.exitCode = 1; break; }
  }
}

main().catch(() => {
  console.error("답변 문체 진단을 완료하지 못했어요. 연결 설정을 확인해 주세요.");
  process.exitCode = 1;
});
