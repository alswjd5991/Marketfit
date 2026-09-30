import { generateGeminiReply, type GeminiResult, type GeminiSource, type GeminiTurn } from "./gemini";
import {
  formatEvents, getOfficialEvents, isSameEvent, koreaDate, parseEventQuery, sortEvents, TOPIC,
  type EventQuery, type EventRecord, type OfficialEvents,
} from "./event-search";

/** Marketfit 등록 행사가 이 수보다 적으면 다른 웹사이트에서 보충한다. */
export const ENOUGH_EVENTS = 3;
const MAX_SHOWN = 8;

// 본인 기록에 대한 질문. 웹 검색 없이 Marketfit에 저장된 가게·참가·판매 기록으로만 답한다.
const PERSONAL = /내\s*가게|우리\s*가게|내가|제가|나의|저의|내\s|제\s|매출|순이익|수익|이익|손해|적자|판매량|많이\s*팔|참가한|참여한|나갔던|다녀온|만족도|재참가|내\s*상품|우리\s*상품/;

const PERSONAL_PROMPT = `당신은 "마켓핏"이라는 소상공인 행사 참가 데이터 플랫폼의 AI 도우미입니다.
이 질문은 사용자 본인의 가게·참가·판매 기록에 관한 것입니다. 아래 기록만 근거로 분석해 한국어로 간결하고 구체적으로 답하세요.
- 합계·평균·최고/최저·순위는 "계산된 통계"의 숫자를 그대로 쓰고 직접 다시 계산하지 마세요.
- 기록에 없는 숫자·행사·상품은 지어내지 말고, 근거가 부족하면 "기록에 없어서 답하기 어려워요"라고 말하세요.
- 행사 추천을 요청하면 "Marketfit 등록 예정 행사" 목록 안에서만 고르고, 사용자 기록(업종, 성과가 좋았던 행사 등)을 근거로 이유를 설명하세요.`;

const GENERAL_PROMPT = `당신은 "마켓핏"이라는 소상공인 행사 참가 데이터 플랫폼의 AI 도우미입니다.
일반 질문(트렌드, 준비 방법 등)은 구글 검색 도구로 실제 최신 정보를 찾아 답하세요. 검색 없이 아는 척 지어내지 말고, 검색 결과에 없는 내용은 답하지 마세요.
사용자 본인의 매출·참가 기록은 이 요청에 포함되지 않았습니다. 그런 내용이 필요하면 "내 매출", "내가 참가한 행사"처럼 다시 물어봐 달라고 안내하세요.
답변은 한국어로, 간결하고 구체적으로 제시하세요.`;

export interface ChatDeps {
  /** 로그인 사용자의 가게 기록 요약(계산된 통계 포함). 가게가 없으면 null. */
  storeContext(): Promise<string | null>;
  /** Marketfit DB에 등록된 행사. */
  marketfitEvents(query: EventQuery): Promise<EventRecord[]>;
}

export type ChatReply = { ok: true; text: string; sources: GeminiSource[] } | { ok: false; error: string };

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 질문 종류별 조회 순서:
 * 1) 개인 질문 → Marketfit 가게 기록(코드가 계산한 통계) → AI는 설명만, 웹 검색 없음
 * 2) 행사·일정·모집 질문 → Marketfit 등록 행사 → 3건 미만이면 서울시/한국관광공사 → 그래도 3건 미만이면 웹 검색
 * 3) 그 외 일반 질문 → 웹 검색(Gemini)
 */
export async function generateChatReply(history: GeminiTurn[], deps: ChatDeps, now = new Date()): Promise<ChatReply> {
  const users = history.filter((turn) => turn.role === "user");
  const latest = users.at(-1)?.text.trim() ?? "";
  const today = koreaDate(now);
  const dateLine = `현재 한국 날짜는 ${today}입니다. 상대 날짜는 이 날짜를 기준으로 해석하세요.`;

  // "그럼 지난달은?"처럼 짧은 후속 질문은 직전 질문이 개인 질문이면 개인 질문으로 본다.
  const followsPersonal = latest.length < 30 && !TOPIC.test(latest) && PERSONAL.test(users.at(-2)?.text ?? "");
  if (PERSONAL.test(latest) || followsPersonal) return personalReply(history, deps, today, dateLine, TOPIC.test(latest));

  const query = parseEventQuery(history, now);
  if (query) return eventReply(query, history, deps, dateLine);
  return generateGeminiReply(`${GENERAL_PROMPT}\n\n${dateLine}`, history);
}

async function personalReply(history: GeminiTurn[], deps: ChatDeps, today: string, dateLine: string, wantsEvents: boolean): Promise<ChatReply> {
  const context = await deps.storeContext();
  const parts = [PERSONAL_PROMPT, context ?? "(이 사용자는 아직 가게를 등록하지 않아서 참가/판매 기록이 없어요. 가게 등록부터 안내해 주세요.)"];
  if (wantsEvents) {
    // "내 가게에 맞는 행사 추천"처럼 행사가 섞인 질문은 앞으로 60일간의 Marketfit 등록 행사를 함께 준다.
    const upcoming = await deps.marketfitEvents({ from: today, to: addDays(today, 60), today, marketOnly: false, recruit: false, region: "전국" }).catch(() => []);
    parts.push(upcoming.length
      ? `## Marketfit 등록 예정 행사 (${today}부터 60일)\n${sortEvents(upcoming, { from: today, to: addDays(today, 60), today, marketOnly: false, recruit: false, region: "전국" })
        .slice(0, 30).map((e) => `- ${e.name} (${e.start}~${e.end}, ${e.place}${e.detail ? `, ${e.detail}` : ""})`).join("\n")}`
      : "## Marketfit 등록 예정 행사\n앞으로 60일 안에 등록된 행사가 없습니다.");
  }
  parts.push(dateLine);
  return generateGeminiReply(parts.join("\n\n"), history, [false]);
}

async function eventReply(query: EventQuery, history: GeminiTurn[], deps: ChatDeps, dateLine: string): Promise<ChatReply> {
  let db: EventRecord[] = [];
  let dbFailed = false;
  try {
    db = sortEvents(await deps.marketfitEvents(query), query);
  } catch {
    dbFailed = true;
  }

  // 1차 보충: 공식 행사 목록. 행사 목록에는 모집 정보가 없어서 모집 질문에는 쓰지 않는다.
  let official: OfficialEvents | null = null;
  let extra: EventRecord[] = [];
  if (db.length < ENOUGH_EVENTS && !query.recruit) {
    official = await getOfficialEvents(query);
    if (official) extra = sortEvents(official.events.filter((e) => !db.some((d) => isSameEvent(d, e))), query);
  }

  // 2차 보충: 웹 검색. 검색 결과 없이 만든 답은 최신 행사 정보가 아니므로 쓰지 않는다.
  let web: GeminiResult | null = null;
  if (db.length + extra.length < ENOUGH_EVENTS) {
    web = await generateGeminiReply(webSearchPrompt(query, [...db, ...extra].map((e) => e.name), dateLine), history, [true]);
  }
  const webOk = web?.ok ? web : null;
  if (dbFailed && !official && !webOk) {
    return { ok: false, error: "지금은 행사 정보를 불러올 수 없어요. 질문은 저장됐으니 잠시 후 다시 시도해 주세요." };
  }

  const range = query.from === query.to ? query.from : `${query.from} ~ ${query.to}`;
  const kind = query.recruit ? "셀러 모집 행사" : query.marketOnly ? "마켓" : "행사";
  const lines = [`${range} ${query.region} ${kind} 일정이에요. (${query.today} 기준)`];
  const sources: GeminiSource[] = [];

  const shownDb = db.slice(0, MAX_SHOWN);
  if (dbFailed) lines.push("■ Marketfit 등록 행사\n지금 Marketfit 행사 목록을 불러오지 못했어요.");
  else if (!db.length) lines.push("■ Marketfit 등록 행사\n조건에 맞는 행사가 아직 등록되어 있지 않아요.");
  else {
    lines.push(`■ Marketfit에 등록된 행사 (${db.length}건)`, ...formatEvents(shownDb, query));
    if (db.length > shownDb.length) lines.push(`외 ${db.length - shownDb.length}건은 Marketfit 행사 목록에서 확인해 주세요.`);
    sources.push(...shownDb.map((e) => ({ title: e.name, url: e.url })));
  }

  if (official) {
    const shownExtra = extra.slice(0, Math.max(0, MAX_SHOWN - shownDb.length));
    lines.push(`■ 다른 웹사이트에서 가져온 행사 — 출처: ${official.label}\nMarketfit에 등록된 행사가 ${ENOUGH_EVENTS}건 미만이라 다른 웹사이트에서 추가로 찾아봤어요. Marketfit에 등록되지 않은 행사예요.`);
    if (shownExtra.length) {
      lines.push(...formatEvents(shownExtra, query, shownDb.length + 1));
      if (extra.length > shownExtra.length) lines.push(`외 ${extra.length - shownExtra.length}건은 아래 행사 달력에서 확인해 주세요.`);
      sources.push(...shownExtra.map((e) => ({ title: `[${official!.short}] ${e.name}`, url: e.url })), official.calendar);
    } else {
      lines.push("추가로 찾은 행사가 없어요.");
    }
  }

  if (webOk) {
    lines.push(`■ 다른 웹사이트에서 찾은 정보 — 출처: 구글 웹 검색(Gemini AI 요약)\n등록된 행사가 ${ENOUGH_EVENTS}건 미만이라 웹 검색으로 추가로 찾아봤어요. 내용이 정확한지 아래 출처 링크에서 꼭 확인해 주세요.\n\n${webOk.text}`);
    sources.push(...webOk.sources.map((s) => ({ title: `[웹 검색] ${s.title}`, url: s.url })));
  } else if (web) {
    lines.push("■ 웹 검색\n지금은 웹 검색을 연결할 수 없어 추가 행사를 찾지 못했어요. 해당 기간에 행사가 없다는 뜻은 아니에요.");
  }

  lines.push(query.recruit
    ? "모집 마감일과 참가 조건은 바뀔 수 있으니 신청 전에 원문 공고를 확인해 주세요."
    : "표시된 기간 내 매일 운영된다는 뜻은 아니에요. 운영일·시간과 변경 여부는 출처를 확인해 주세요. 셀러 모집 정보는 Marketfit에 모집 공고가 등록된 행사에만 표시돼요.");
  return { ok: true, text: lines.join("\n\n"), sources };
}

function webSearchPrompt(query: EventQuery, known: string[], dateLine: string): string {
  const what = query.recruit ? "셀러(판매자)를 모집 중인 행사·플리마켓" : query.marketOnly ? "플리마켓·장터" : "행사·축제";
  return `당신은 "마켓핏" AI 도우미입니다. 구글 검색으로 ${query.region === "전국" ? "전국" : `${query.region} 지역`}에서 ${query.from}~${query.to} 기간에 열리는 ${what}를 찾아 한국어 목록으로 간결하게 답하세요.
각 항목에 행사명, 기간, 장소${query.recruit ? ", 모집 마감일" : ""}을 적고, 검색 결과에서 확인한 내용만 쓰세요. 기간이 맞지 않거나 날짜를 확인할 수 없는 행사는 빼세요.
찾지 못했으면 "웹 검색에서 추가로 확인된 행사가 없어요."라고만 답하세요.
${known.length ? `다음 행사는 이미 안내했으니 제외하세요: ${known.join(", ")}` : ""}

${dateLine}`;
}
