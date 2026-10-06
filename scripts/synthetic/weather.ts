// 행사 날짜·지역의 실제 날씨 — 기상청 지상(종관, ASOS) 일자료 조회서비스(공공데이터포털).
// 합성 셀러의 "그날 날씨" 기록을 가정이 아니라 실측값으로 채운다.
//
// 분류 기준(기상청 통계 관례를 따름):
//   비/눈: 일강수량 1.0mm 이상(기상청 "강수일수(1.0mm 이상)" 기준). 그날 새로 쌓인 눈(일 최심신적설 > 0)이 있으면 눈.
//   흐림:  강수 없음 + 일평균 전운량 8.5 이상(기상청 하늘상태 '흐림' 9~10 구간). '구름많음'(6~8)은 앱 선택지에 없어 맑음으로 묶음.
//   맑음:  그 밖
//
// 지역(시·도)마다 대표 관측소 하나를 쓴다(아래 표). 응답은 scripts/.cache/에 저장해 다시 받지 않는다.
// 키: .env.local의 DATA_GO_KR_KEY (공공데이터포털에서 "기상청_지상(종관, ASOS) 일자료 조회서비스" 활용신청 필요).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Weather = "맑음" | "흐림" | "비" | "눈";

/** 시·도 → ASOS 대표 관측소 번호(도청 소재지 또는 인접 관측소). */
export const REGION_STATION: Record<string, number> = {
  서울: 108, 부산: 159, 대구: 143, 인천: 112, 광주: 156, 대전: 133, 울산: 152, 세종: 239,
  경기: 119 /* 수원 */, 강원: 101 /* 춘천 */, 충북: 131 /* 청주 */, 충남: 177 /* 홍성 */,
  전북: 146 /* 전주 */, 전남: 165 /* 목포 */, 경북: 136 /* 안동 */, 경남: 155 /* 창원 */, 제주: 184,
};

const API = "https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList";
const CACHE = path.join(process.cwd(), "scripts", ".cache");

interface DailyRow { tm: string; sumRn?: string; avgTca?: string; ddMefs?: string }

export function classify(row: DailyRow): Weather {
  const rain = Number(row.sumRn || 0);
  if (rain >= 1.0) return Number(row.ddMefs || 0) > 0 ? "눈" : "비";
  return Number(row.avgTca || 0) >= 8.5 ? "흐림" : "맑음";
}

async function fetchYear(key: string, station: number, year: number, yesterday: string): Promise<Record<string, Weather>> {
  const file = path.join(CACHE, `asos-${station}-${year}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const start = `${year}0101`;
  const endIso = `${year}-12-31` < yesterday ? `${year}-12-31` : yesterday;
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const params = new URLSearchParams({ pageNo: "1", numOfRows: "999", dataType: "JSON", dataCd: "ASOS", dateCd: "DAY", startDt: start, endDt: endIso.replaceAll("-", ""), stnIds: String(station) });
  const res = await fetch(`${API}?serviceKey=${serviceKey}&${params}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`ASOS HTTP ${res.status}`);
  const data = await res.json() as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: DailyRow[] } } } };
  if (data.response?.header?.resultCode !== "00") throw new Error(`ASOS 거절: ${data.response?.header?.resultMsg ?? "알 수 없음"}`);
  const out: Record<string, Weather> = {};
  for (const row of data.response.body?.items?.item ?? []) out[row.tm] = classify(row);
  mkdirSync(CACHE, { recursive: true });
  // 올해 자료는 아직 쌓이는 중이라 캐시하지 않는다.
  if (`${year}-12-31` < yesterday) writeFileSync(file, JSON.stringify(out));
  return out;
}

/**
 * (지역, 날짜) → 실측 날씨 조회 함수를 만든다. 키가 없거나 API가 실패하면 null을 돌려주고,
 * 호출하는 쪽이 [가정] 분포로 대체한다(그 사실을 보고서에 출력).
 */
export async function loadWeather(key: string | undefined, regions: string[], years: number[], today: string): Promise<((region: string | null, date: string) => Weather | null) | null> {
  if (!key) return null;
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const table = new Map<number, Record<string, Weather>>();
  try {
    for (const station of new Set(regions.map((r) => REGION_STATION[r]).filter(Boolean))) {
      const merged: Record<string, Weather> = {};
      for (const y of years) Object.assign(merged, await fetchYear(key, station, y, yesterday));
      table.set(station, merged);
    }
  } catch (err) {
    console.warn(`기상청 ASOS 조회 실패 — [가정] 날씨 분포로 대체합니다: ${err instanceof Error ? err.message : err}`);
    return null;
  }
  return (region, date) => (region && REGION_STATION[region] ? table.get(REGION_STATION[region])?.[date] ?? null : null);
}
