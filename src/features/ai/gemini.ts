// Gemini generateContent REST 호출을 감싸는 얇은 클라이언트.
// GEMINI_API_KEY가 없으면(아직 미연결) 호출하지 않고 명확한 에러를 돌려준다 —
// 62번 항목(네트워크 오류로 페이지 전체가 죽지 않도록)과 같은 결의 방어.
//
// 모델/엔드포인트: 2026-09 기준 Gemini API 문서(ai.google.dev/api/generate-content)로
// 확인한 현재 값. generateContent는 활성 API이고(2026-06 "Interactions API"가
// 새로 나왔지만 generateContent도 계속 지원됨), 기본 flash 모델은 gemini-3.8-flash.
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

export type GeminiResult = { ok: true; text: string } | { ok: false; error: string };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * systemInstruction(그라운딩 컨텍스트 포함) + 대화 히스토리를 넣어 한 턴을 생성한다.
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

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
        generationConfig: {
          temperature: 0.3, // 근거 데이터 밖으로 나가는 창작을 줄이기 위해 낮게
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { ok: false, error: `Gemini API 오류 (${res.status}): ${bodyText.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) {
      return { ok: false, error: "응답이 비어 있어요." };
    }
    return { ok: true, text: text.trim() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요." };
  }
}
