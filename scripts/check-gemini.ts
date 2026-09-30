import { config } from "dotenv";
import { generateGeminiReply, type GeminiTurn } from "../src/features/ai/gemini";

// 명시적으로 실행할 때만 실제 API를 호출한다. 키/사용자 DB/기존 대화는 출력하지 않는다.
config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is missing");
  const system = `당신은 마켓핏 AI 도우미입니다. 한국어로 간결하게 답하세요.
가게 관련 질문은 제공된 기록만 사용하고 일반 질문은 구글 검색으로 확인하세요.
없는 숫자나 최신 정보를 지어내지 마세요.
다음은 실제 사용자 정보가 아닌 진단용 가상 데이터입니다: 테스트 행사 매출 100000원, 비용 30000원.`;
  const history: GeminiTurn[] = [];
  for (const question of ["진단용 가상 데이터의 순이익을 계산해 줘.", "이번 주말 서울의 플리마켓 모집이 지금 열려 있는지 확인해 줘."]) {
    history.push({ role: "user", text: question });
    const started = Date.now();
    const result = await generateGeminiReply(system, history);
    console.log(JSON.stringify({ elapsedMs: Date.now() - started, ...result }, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
      return;
    }
    history.push({ role: "model", text: result.text });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "진단 실패");
  process.exitCode = 1;
});
