import assert from "node:assert/strict";
import { generateChatReply } from "../src/features/ai/reply";

// 실제 채팅과 같은 진입점을 호출한다. DB 수정이나 Gemini 사용량은 발생하지 않는다.
async function main() {
  const result = await generateChatReply("실제 확인된 행사만 답하세요.", [
    { role: "user", text: "이번 달 서울에서 열리는 행사는?" },
  ]);
  assert.ok(result.ok);
  assert.ok(result.text.includes("서울시 공식 행사 자료에서 확인한"), "Live lookup did not succeed");
  assert.ok(result.sources.length > 1, "No actual event sources were returned");
  assert.equal(result.text.includes("웹 검색을 연결할 수 없어"), false);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "행사 조회 검증 실패");
  process.exitCode = 1;
});
