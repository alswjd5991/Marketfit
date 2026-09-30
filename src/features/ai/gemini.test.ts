import assert from "node:assert/strict";
import { beforeEach, afterEach, test, mock } from "node:test";
import { generateGeminiReply, isGeminiConfigured, SEARCH_UNAVAILABLE_NOTICE } from "./gemini";

const history = [{ role: "user" as const, text: "내 매출은?" }];
const originalKey = process.env.GEMINI_API_KEY;
const originalModels = process.env.GEMINI_MODELS;
let sequence = 0;

beforeEach(() => {
  process.env.GEMINI_API_KEY = `test-key-${++sequence}`;
  process.env.GEMINI_MODELS = "first,second";
  mock.method(console, "warn", () => {});
});
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModels === undefined) delete process.env.GEMINI_MODELS;
  else process.env.GEMINI_MODELS = originalModels;
});

const success = () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "매출은 10만 원이에요." }] } }] });
const failure = (status: number, message = "quota", headers?: HeadersInit) =>
  Response.json({ error: { status: "TEST_ERROR", message } }, { status, headers });

test("키 미설정·빈 메시지는 API 요청을 보내지 않는다", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => success());
  process.env.GEMINI_API_KEY = "  ";
  assert.equal(isGeminiConfigured(), false);
  assert.equal((await generateGeminiReply("system", history)).ok, false);
  process.env.GEMINI_API_KEY = "configured";
  assert.equal((await generateGeminiReply("system", [])).ok, false);
  assert.equal((await generateGeminiReply("system", [{ role: "user", text: " " }])).ok, false);
  assert.equal(fetch.mock.callCount(), 0);
});

for (const status of [404, 408, 429, 500, 502, 503, 504]) {
  test(`${status} 오류 뒤 다음 모델에서 답변한다`, async () => {
    let calls = 0;
    const fetch = mock.method(globalThis, "fetch", async () => ++calls === 1 ? failure(status) : success());
    const result = await generateGeminiReply("system", history);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.model, "second");
      assert.equal(result.searchEnabled, true);
    }
    assert.equal(fetch.mock.callCount(), 2);
  });
}

test("모든 검색 요청 429 → 검색 없는 답변, 정확한 안내와 빈 출처", async () => {
  const requests: { url: string; body: Record<string, unknown>; options?: RequestInit }[] = [];
  mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    requests.push({ url: String(url), body, options });
    return body.tools ? failure(429) : success();
  });
  const result = await generateGeminiReply("실제 기록만 답하세요", history);
  assert.equal(requests.length, 3);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.searchEnabled, false);
    assert.ok(result.text.startsWith(SEARCH_UNAVAILABLE_NOTICE));
    assert.deepEqual(result.sources, []);
  }
  assert.ok(JSON.stringify(requests[2].body.systemInstruction).includes("최신 트렌드"));
  for (const request of requests) {
    assert.equal(request.url.includes(process.env.GEMINI_API_KEY!), false);
    assert.equal(request.options?.cache, "no-store");
    assert.ok(request.options?.signal);
  }
  // 다음 턴은 검색 429만 건너뛰며 같은 모델의 정상 텍스트 경로는 유지한다.
  await generateGeminiReply("실제 기록만 답하세요", history);
  assert.equal(requests.length, 4);
  assert.equal(requests[3].body.tools, undefined);
});

test("네트워크·시간 초과 오류가 모델 전환을 중단하지 않는다", async () => {
  process.env.GEMINI_MODELS = "first,second,third";
  let calls = 0;
  mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 1) throw new TypeError("fetch failed");
    if (calls === 2) throw new DOMException("timeout", "TimeoutError");
    return success();
  });
  const result = await generateGeminiReply("system", history);
  assert.ok(result.ok && result.model === "third");
});

for (const status of [400, 401, 403]) {
  test(`${status} 설정·인증 오류는 반복 호출하거나 내부 내용을 노출하지 않는다`, async () => {
    const fetch = mock.method(globalThis, "fetch", async () => failure(status, "private diagnostic"));
    const result = await generateGeminiReply("system", history);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.includes("private diagnostic"), false);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test("검색 도구 미지원 모델은 다음 후보를 시도한다", async () => {
  let calls = 0;
  const fetch = mock.method(globalThis, "fetch", async () => ++calls === 1
    ? failure(400, "google_search is not supported") : success());
  assert.equal((await generateGeminiReply("system", history)).ok, true);
  assert.equal(fetch.mock.callCount(), 2);
});

test("응답 JSON 오류·빈 답변·잘린 답변은 완성된 답변으로 전환한다", async () => {
  process.env.GEMINI_MODELS = "first,second,third,fourth";
  const responses = [new Response("bad json"), Response.json({}), Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "잘린 답변" }] } }] }), success()];
  mock.method(globalThis, "fetch", async () => responses.shift()!);
  const result = await generateGeminiReply("system", history);
  assert.ok(result.ok && result.model === "fourth");
});

test("차단된 응답은 모델을 바꿔 우회하지 않는다", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => Response.json({ promptFeedback: { blockReason: "SAFETY" } }));
  assert.equal((await generateGeminiReply("system", history)).ok, false);
  assert.equal(fetch.mock.callCount(), 1);
});

test("추론 텍스트를 제외하고 중복·잘못된 출처를 거른다", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "내부 추론", thought: true }, { text: "최종 답변" }] }, groundingMetadata: { groundingChunks: [
    { web: { uri: "https://example.com", title: "출처" } },
    { web: { uri: "https://example.com", title: "출처" } },
    { web: { uri: "javascript:alert(1)" } },
    { web: { uri: "not a url" } },
  ] } }] }));
  const result = await generateGeminiReply("system", history);
  assert.ok(result.ok);
  assert.equal(result.text, "최종 답변");
  assert.deepEqual(result.sources, [{ title: "출처", url: "https://example.com" }]);
});

test("전체 한도 소진 시 호출 횟수를 제한하고 재시도 안내를 반환한다", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => failure(429));
  const result = await generateGeminiReply("system", history);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.retryable, true);
  assert.equal(fetch.mock.callCount(), 4);
  await generateGeminiReply("system", history);
  assert.equal(fetch.mock.callCount(), 4);
});

test("Retry-After와 Google RetryInfo를 지킨 뒤 검색 모델을 다시 시도한다", async () => {
  let now = Date.now();
  mock.method(Date, "now", () => now);
  process.env.GEMINI_MODELS = "first";
  let calls = 0;
  mock.method(globalThis, "fetch", async () => ++calls === 1
    ? Response.json({ error: { details: [{ retryDelay: "180s" }] } }, { status: 429, headers: { "retry-after": "120" } })
    : success());
  await generateGeminiReply("system", history);
  now += 121_000;
  const duringCooldown = await generateGeminiReply("system", history);
  assert.ok(duringCooldown.ok && !duringCooldown.searchEnabled);
  now += 60_000;
  const recovered = await generateGeminiReply("system", history);
  assert.ok(recovered.ok && recovered.searchEnabled);
});

test("실패 후 연속 사용자 메시지를 유지하며 하나의 턴으로 묶는다", async () => {
  mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "첫 질문" }, { text: "추가 질문" }] }]);
    return success();
  });
  assert.equal((await generateGeminiReply("system", [{ role: "user", text: "첫 질문" }, { role: "user", text: "추가 질문" }])).ok, true);
});
