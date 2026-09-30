import { generateGeminiReply, type GeminiTurn } from "./gemini";
import { getEventReply } from "./event-search";

/** 공개 일정 조회는 Google 검색/모델 한도에 의존하지 않고 출처와 함께 답한다. */
export async function generateChatReply(systemInstruction: string, history: GeminiTurn[]) {
  const eventReply = await getEventReply(history);
  if (eventReply) return eventReply;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  return generateGeminiReply(`${systemInstruction}\n\n현재 한국 날짜는 ${today}입니다. 상대 날짜는 이 날짜를 기준으로 해석하세요.`, history);
}
