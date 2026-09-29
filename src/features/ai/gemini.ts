// Gemini generateContent REST 호출을 감싸는 얇은 클라이언트.
// GEMINI_API_KEY가 없으면(아직 미연결) 호출하지 않고 명확한 에러를 돌려준다 —
// 62번 항목(네트워크 오류로 페이지 전체가 죽지 않도록)과 같은 결의 방어.
//
// 모델/엔드포인트: 2026-09 기준 Gemini API 문서(ai.google.dev/api/generate-content)로
// 확인한 현재 값. generateContent는 활성 API이고(2026-06 "Interactions API"가
// 새로 나왔지만 generateContent도 계속 지원됨).
//
// 2026-09-29: 무료 등급에서 기본 모델(gemini-3.8-flash)이 429(TooManyRequests)/503
// (ServiceUnavailable)을 내는 걸 AI Studio 사용량 대시보드로 확인 — 같은 GEMINI_API_KEY라도
// 무료 등급 한도는 "모델별로 따로" 집계된다(대시보드에 Gemini 3.8 Flash/2.5 Flash 등이 각자
// RPM/TPM/RPD를 갖고 있고, 하나가 막혀도 다른 모델은 남아있는 걸 실제로 확인). 그래서 새
// API 제공사로 갈아타는 대신, 같은 계정 안에서 기본 모델이 429/503일 때만 예비 모델로
// 자동 전환하는 방식을 택함 — 새 키 발급이나 요금제 가입 없이 바로 적용 가능.
const MODEL_CANDIDATES = ["gemini-3.8-flash", "gemini-2.5-flash"] as const;

function endpointFor(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

export interface GeminiSource {
  title: string;
  url: string;
}

export type GeminiResult =
  | { ok: true; text: string; sources: GeminiSource[] }
  | { ok: false; error: string; retryable?: boolean };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Gemini generateContent 응답 중 이 클라이언트가 실제로 쓰는 부분만 타입으로 적어둔다
// (전체 스키마를 다 옮기지 않고, 우리가 읽는 필드만).
interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
}

/**
 * systemInstruction(그라운딩 컨텍스트 포함) + 대화 히스토리를 넣어 한 턴을 생성한다.
 * 구글 검색 그라운딩(tools: google_search)을 항상 켜서, 이 가게의 기록 밖 —
 * 예: "요즘 플리마켓 트렌드 어때?" 같은 일반 질문에도 실제 웹 검색 결과를
 * 근거로 답할 수 있게 한다. 근거로 쓴 웹 페이지는 sources로 함께 돌려줘서
 * 화면에 출처로 보여준다(37번 항목: 근거 없는 숫자 생성 방지 — 검색 결과도
 * 출처를 밝혀야 근거가 된다).
 *
 * `MODEL_CANDIDATES`를 앞에서부터 순서대로 시도한다 — 429/503(할당량·일시 과부하)이면
 * 다음 후보 모델로 자동 전환하고, 그 외 오류(인증 문제 등 모델을 바꿔도 똑같이 날 문제)는
 * 즉시 실패로 반환한다. 후보를 다 써도 안 되면 그때 비로소 사용자에게 "잠시 후 재시도"
 * 안내를 보여준다.
 * 키 미설정/네트워크 오류/빈 응답 등 실패 케이스는 전부 { ok: false }로 돌려주고
 * 절대 그럴듯한 답을 지어내 채우지 않는다(65번 원칙).
 */
export async function generateGeminiReply(
  systemInstruction: string,
  history: GeminiTurn[]
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY가 설정되지 않았어요." };
  }
  if (history.length === 0) {
    return { ok: false, error: "빈 대화는 전송할 수 없어요." };
  }

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.3, // 근거 데이터 밖으로 나가는 창작을 줄이기 위해 낮게
      maxOutputTokens: 1024,
    },
  });

  let lastRetryableError: string | null = null;

  try {
    for (const model of MODEL_CANDIDATES) {
      const res = await fetch(`${endpointFor(model)}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        const rawError = `Gemini API 오류 (${res.status}): ${bodyText.slice(0, 200)}`;

        if (res.status === 429 || res.status === 503) {
          // 이 모델의 무료 할당량이 찼거나 구글 쪽이 일시 과부하 — 다음 후보 모델로 넘어간다.
          console.error(`[gemini] ${model} 응답 실패(${res.status}) — 다음 후보 모델로 전환`, bodyText.slice(0, 200));
          lastRetryableError = rawError;
          continue;
        }

        // 429/503이 아닌 오류(인증 문제 등)는 모델을 바꿔도 똑같이 날 가능성이 높아 바로 반환.
        return { ok: false, error: rawError };
      }

      const data = (await res.json()) as GenerateContentResponse;
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) {
        return { ok: false, error: "응답이 비어 있어요." };
      }

      const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
      const seen = new Set<string>();
      const sources: GeminiSource[] = [];
      for (const chunk of chunks) {
        const uri = chunk.web?.uri;
        if (!uri || seen.has(uri)) continue;
        seen.add(uri);
        sources.push({ title: chunk.web?.title ?? uri, url: uri });
      }

      return { ok: true, text: text.trim(), sources };
    }

    // 후보 모델을 전부 시도했는데도 다 429/503 — 사용자 잘못이 아님을 명확히 안내한다.
    console.error("[gemini] 모든 후보 모델이 429/503으로 실패", lastRetryableError);
    return {
      ok: false,
      error: "지금 요청이 많이 몰려서 답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요." };
  }
}
