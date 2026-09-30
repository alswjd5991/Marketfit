import { createHash } from "node:crypto";

// 검색 도구가 막혀도 텍스트 생성 한도는 남아 있을 수 있다.
// 검색 포함/미포함 요청의 상태를 별도로 관리해야 정상 모델을 함께 차단하지 않는다.
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const ATTEMPT_TIMEOUT_MS = 10_000;
const MODE_TIMEOUT_MS = 25_000;
const cooldowns = new Map<string, number>();

export const SEARCH_UNAVAILABLE_NOTICE = "현재 웹 검색을 연결할 수 없어 최신 정보는 확인하지 못했어요. 아래 답변은 저장된 가게 기록과 일반적인 설명을 기준으로 해요.";
const WITHOUT_SEARCH_INSTRUCTION = `현재 웹 검색 도구를 사용할 수 없습니다. 앞의 검색 지침 대신 다음 제한을 적용하세요.
사용자 본인의 수치·상품·참가 기록은 제공된 가게 데이터만 근거로 답하세요.
일반 개념이나 준비 방법은 설명할 수 있지만, 최신 트렌드·현재 가격·날짜별 행사·모집 여부는 확인할 수 없다고 답하세요.
검색했다고 주장하거나 검색 결과, 출처 URL, 최신 사실을 지어내지 마세요. 이전 대화의 검색 결과도 현재 확인된 정보로 취급하지 마세요.`;

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

export interface GeminiSource {
  title: string;
  url: string;
}

export type GeminiResult =
  | { ok: true; text: string; sources: GeminiSource[]; model: string; searchEnabled: boolean }
  | { ok: false; error: string; retryable?: boolean };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

interface GenerateContentResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
}

interface ApiError {
  error?: {
    status?: string;
    message?: string;
    details?: {
      retryDelay?: string;
      violations?: { quotaId?: string; quotaMetric?: string }[];
    }[];
  };
}

function retryDelayMs(response: Response, data: ApiError): number {
  const header = response.headers.get("retry-after");
  const headerMs = header
    ? (/^\d+(\.\d+)?$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now())
    : 0;
  const detailMs = Math.max(0, ...(data.error?.details ?? []).map((d) =>
    /^\d+(\.\d+)?s$/.test(d.retryDelay ?? "") ? parseFloat(d.retryDelay!) * 1000 : 0
  ));
  return Math.max(Number.isFinite(headerMs) ? headerMs : 0, detailMs, response.status === 429 ? 60_000 : 15_000);
}

function sourcesFrom(candidate: NonNullable<GenerateContentResponse["candidates"]>[number]): GeminiSource[] {
  const sources = new Map<string, GeminiSource>();
  for (const chunk of candidate.groundingMetadata?.groundingChunks ?? []) {
    const uri = chunk.web?.uri;
    if (!uri) continue;
    try {
      const url = new URL(uri);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      sources.set(uri, { title: chunk.web?.title || uri, url: uri });
    } catch { /* 잘못된 출처 링크는 표시하지 않는다. */ }
  }
  return [...sources.values()];
}

/**
 * 검색 포함 모델 전환 → 검색 없는 모델 전환. 각 단계와 요청에 시간 제한을 둔다.
 * searchModes로 단계를 고른다: [false]는 가게 기록만 쓰는 개인 질문, [true]는 웹 검색 결과만 필요한 보충 조회.
 */
export async function generateGeminiReply(
  systemInstruction: string,
  history: GeminiTurn[],
  searchModes: boolean[] = [true, false]
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "AI 연결 설정이 필요해요. 관리자에게 문의해 주세요." };
  if (!history.length || history.some((turn) => !turn.text.trim()) || history.at(-1)?.role !== "user") {
    return { ok: false, error: "메시지를 입력해 주세요." };
  }

  const models = [...new Set((process.env.GEMINI_MODELS || DEFAULT_MODELS.join(","))
    .split(",").map((m) => m.trim().replace(/^models\//, "")).filter(Boolean))].slice(0, 6);
  if (!models.length || models.some((m) => !/^[a-zA-Z0-9._-]+$/.test(m))) {
    return { ok: false, error: "AI 모델 설정을 확인해 주세요." };
  }

  // 재시작/여러 서버 간에는 공유되지 않는 best-effort 제한. 원문 키나 대화는 저장하지 않는다.
  const keyId = createHash("sha256").update(apiKey).digest("hex");
  for (const [key, until] of cooldowns) if (until <= Date.now()) cooldowns.delete(key);
  if (cooldowns.size > 128) cooldowns.clear();

  // 실패한 질문이 남아 같은 역할이 연속되는 경우 하나의 턴으로 묶는다.
  const contents: { role: GeminiTurn["role"]; parts: { text: string }[] }[] = [];
  for (const turn of history) {
    const previous = contents.at(-1);
    if (previous?.role === turn.role) previous.parts.push({ text: turn.text });
    else contents.push({ role: turn.role, parts: [{ text: turn.text }] });
  }

  let quotaLimited = false;
  for (const searchEnabled of searchModes) {
    // 검색 요청이 느려도 검색 없는 답변을 시도할 시간을 따로 확보한다.
    const deadline = Date.now() + MODE_TIMEOUT_MS;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: searchEnabled ? systemInstruction : `${systemInstruction}\n\n${WITHOUT_SEARCH_INSTRUCTION}` }] },
      contents,
      ...(searchEnabled ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { maxOutputTokens: 4096 },
    });

    for (const model of models) {
      const stateKey = `${keyId}:${model}:${searchEnabled}`;
      if ((cooldowns.get(stateKey) ?? 0) > Date.now()) continue;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
          cache: "no-store",
          signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({})) as ApiError;
          // 원문에는 민감한 입력이 포함될 수 있으므로 상태와 quota 항목만 기록한다.
          console.warn("[gemini] request failed", {
            model, searchEnabled, status: response.status, code: data.error?.status,
            quotas: data.error?.details?.flatMap((d) => d.violations ?? []),
          });
          if (response.status === 401 || response.status === 403) {
            return { ok: false, error: "AI 연결 키 또는 접근 권한을 확인해 주세요." };
          }
          // 일부 모델에서 검색 도구를 지원하지 않는 400만 모델별 실패로 취급한다.
          const unsupportedSearch = searchEnabled && response.status === 400
            && /google.?search|grounding|tool/i.test(data.error?.message ?? "")
            && /not supported|unsupported|not available/i.test(data.error?.message ?? "");
          if (![404, 408, 429, 500, 502, 503, 504].includes(response.status) && !unsupportedSearch) {
            return { ok: false, error: "AI 요청을 처리할 수 없어요. 연결 설정이나 메시지 길이를 확인해 주세요." };
          }
          quotaLimited ||= response.status === 429;
          cooldowns.set(stateKey, Date.now() + retryDelayMs(response, data));
          continue;
        }

        const data = await response.json() as GenerateContentResponse;
        const candidate = data.candidates?.[0];
        const finish = candidate?.finishReason;
        if (data.promptFeedback?.blockReason || (finish && !["STOP", "MAX_TOKENS"].includes(finish))) {
          return { ok: false, error: "이 질문에 대한 답변을 제공하기 어려워요. 표현을 바꿔 다시 질문해 주세요." };
        }
        const text = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim();
        if (!text || finish === "MAX_TOKENS") {
          console.warn("[gemini] incomplete response", { model, searchEnabled, finish });
          cooldowns.set(stateKey, Date.now() + 15_000);
          continue;
        }
        cooldowns.delete(stateKey);
        return {
          ok: true,
          // 처음부터 검색 없이 요청한 경우(개인 질문)에는 검색 실패 안내를 붙이지 않는다.
          text: searchEnabled || !searchModes.includes(true) ? text : `${SEARCH_UNAVAILABLE_NOTICE}\n\n${text}`,
          sources: searchEnabled && candidate ? sourcesFrom(candidate) : [],
          model,
          searchEnabled,
        };
      } catch (error) {
        // 한 모델의 네트워크/시간 초과/잘못된 JSON이 전체 폴백을 중단하면 안 된다.
        console.warn("[gemini] connection failed", { model, searchEnabled, type: error instanceof Error ? error.name : "UnknownError" });
        cooldowns.set(stateKey, Date.now() + 15_000);
      }
    }
  }
  return {
    ok: false,
    error: quotaLimited
      ? "현재 사용 가능한 AI 모델의 한도에 도달했어요. 질문은 저장됐으니 잠시 후 다시 시도해 주세요. 계속되면 관리자가 API 사용량과 한도를 확인해야 해요."
      : "현재 AI 연결을 사용할 수 없어요. 질문은 저장됐으니 잠시 후 다시 시도해 주세요.",
    retryable: true,
  };
}
