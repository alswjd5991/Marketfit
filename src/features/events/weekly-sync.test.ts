import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSeoulRows, parseTourItems, runWeeklyEventSync, selectSellerEvents, sourceKey } from "./weekly-sync";

const tour = (contentid: string, title: string, start: string, end: string, addr1 = "경기도 수원시 팔달구") =>
  ({ contentid, title, eventstartdate: start, eventenddate: end, addr1, addr2: "행궁광장", firstimage: "http://tong.visitkorea.or.kr/a.jpg", mapx: "127.01", mapy: "37.28" });

test("TourAPI 응답을 기간 안 행사로 바꾸고 지역·이미지·좌표를 채운다", () => {
  const events = parseTourItems([
    tour("101", "수원 행궁동 플리마켓", "20261017", "20261018"),
    tour("102", "지난 축제", "20250101", "20250102"),
    tour("abc", "잘못된 id", "20261017", "20261018"),
  ], "2026-10-06", "2027-01-04");
  assert.equal(events.length, 1);
  assert.equal(events[0].sourceId, "T101");
  assert.equal(sourceKey(events[0]), "tour:T101");
  assert.equal(events[0].region, "경기");
  assert.equal(events[0].imageUrl, "https://tong.visitkorea.or.kr/a.jpg");
  assert.equal(events[0].lat, 37.28);
});

test("서울시 축제 응답은 서울시 전체 상설·삭제 행사를 뺀다", () => {
  const events = parseSeoulRows([
    { festa_code: 7, festa_name: "성수 로컬마켓", strt_date: "2026-10-20", end_date: "2026-10-20", place: "성수동", gcode: "11200" },
    { festa_code: 8, festa_name: "서울 전역 행사", strt_date: "2026-10-20", end_date: "2026-10-20", gcode: "11000" },
    { festa_code: 9, festa_name: "삭제된 마켓", strt_date: "2026-10-20", end_date: "2026-10-20", del_yn: "Y" },
  ], "2026-10-06", "2027-01-04");
  assert.deepEqual(events.map((e) => e.sourceId), ["F7"]);
  assert.throws(() => parseSeoulRows({}, "2026-10-06", "2027-01-04"));
});

test("셀러 참여형만 남기고 출처 간 중복은 하나로 합친다", () => {
  const [market, concert, sameMarket] = [
    ...parseTourItems([tour("1", "제3회 수원 행궁 야시장", "20261017", "20261018"), tour("2", "가을 불꽃 콘서트", "20261017", "20261017")], "2026-10-06", "2027-01-04"),
    ...parseSeoulRows([{ festa_code: 3, festa_name: "수원 행궁 야시장", strt_date: "2026-10-18", end_date: "2026-10-19" }], "2026-10-06", "2027-01-04"),
  ];
  const { kept, duplicates } = selectSellerEvents([market, concert, sameMarket]);
  assert.deepEqual(kept.map((e) => e.sourceId), ["T1"]);
  assert.equal(duplicates, 1);
});

test("dry-run은 출처가 실패해도 보고서를 돌려주고 DB 없이 끝난다", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const report = await runWeeklyEventSync({ supabase: null, dryRun: true, now: new Date("2026-10-05T00:00:00Z") });
    assert.equal(report.range.from, "2026-10-05");
    assert.equal(report.range.to, "2027-01-03");
    assert.equal(report.sources[0].error, "offline");
    assert.equal(report.created, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("기간 수집은 한 달 단위로 나뉘고 빈틈·겹침이 없다", async () => {
  const { monthChunks } = await import("./weekly-sync");
  assert.deepEqual(monthChunks("2024-01-15", "2024-03-10"), [["2024-01-15", "2024-01-31"], ["2024-02-01", "2024-02-29"], ["2024-03-01", "2024-03-10"]]);
  assert.deepEqual(monthChunks("2024-12-31", "2025-01-01"), [["2024-12-31", "2024-12-31"], ["2025-01-01", "2025-01-01"]]);
});

test("NEW는 수집 후 7일 안이면서 그 주에 새로 수집 범위(83~90일 뒤)에 들어온 행사만", async () => {
  const { isNewlyListed } = await import("./weekly-sync");
  const collected = "2026-10-05T00:00:00Z";
  const now = new Date("2026-10-07T00:00:00Z");
  assert.equal(isNewlyListed(collected, "2027-01-01", now), true); // 88일 뒤
  assert.equal(isNewlyListed(collected, "2026-10-20", now), false); // 처음 수집 때 한꺼번에 들어온 근일 행사
  assert.equal(isNewlyListed(collected, "2025-05-01", now), false); // 과거 행사
  assert.equal(isNewlyListed(collected, "2027-01-01", new Date("2026-10-13T00:00:00Z")), false); // 일주일 지남
  assert.equal(isNewlyListed(null, "2027-01-01", now), false); // 직접 수집한 시드 행사
});

test("TourAPI 상세 응답에서 HTML을 걷어내고 빈 항목은 저장하지 않는다", async () => {
  const { parseTourDetails } = await import("./weekly-sync");
  const d = parseTourDetails(
    { overview: "가을 장터<br>지역 농산물 판매", homepage: '<a href="http://www.example.go.kr" target="_blank">www.example.go.kr</a>', tel: "" },
    { playtime: "10:00~18:00", sponsor1: "OO시", sponsor2: "", sponsor1tel: "031-000-0000", usetimefestival: "무료", eventplace: "시청 광장" }
  );
  assert.deepEqual(d, {
    overview: "가을 장터\n지역 농산물 판매", playtime: "10:00~18:00", place: "시청 광장", sponsor: "OO시",
    tel: "031-000-0000", admission: "무료", homepage: "http://www.example.go.kr",
  });
});

test("셀러 판매 부스를 낼 수 있는 행사만 남긴다", async () => {
  const { isSellerEvent } = await import("./weekly-sync");
  const yes = [
    "2026 수원 행궁동 플리마켓", "광화문 크리스마스마켓", "목포 국가유산 야행 플리마켓", "서울밤도깨비야시장", "OO 농특산물 직거래 장터",
    "망원 한강공원 벼룩시장", "OO 로컬푸드 축제", "OO 먹거리 한마당", "청주 공예 아트마켓", "OO 핸드메이드 페어",
    "대한민국 커피 엑스포", "OO 베이비페어", "OO 수산물 박람회", "김장 문화제", "푸드트럭 페스티벌",
  ];
  const no = [
    "2026 부산국제공연예술마켓(BPAM)", "APAP 작품투어(안양공공예술프로젝트)", "귀농귀촌 박람회", "OO 취업 박람회", "국제 콘텐츠 마켓",
    "OO 국제 아트페어", "OO 불꽃축제", "OO 국제 영화제", "로컬 크리에이터 포럼", "크리스마스 콘서트", "OO 문화유산 야행",
    "OO 진로 교육 박람회", "OO 사진전",
  ];
  for (const name of yes) assert.equal(isSellerEvent(name), true, name);
  for (const name of no) assert.equal(isSellerEvent(name), false, name);
});

test("서울시 문화행사 정보의 실제 행사명: 마켓은 남기고 공예박물관 강좌·전시·도서관 프로그램은 뺀다", async () => {
  const { isSellerEvent } = await import("./weekly-sync");
  const yes = [
    "DDP 상생마켓: 서울패션허브 FALL MARKET", "2026 Be My OBJECT [나만의 소품&오브제 마켓]", "[서울아트책보고] 씨드북 [지구를 위한 옷장 순환 마켓]",
    "2026 백년시장 야시장 [백년나이트 : 메기의 귀환]", "DDP 상생마켓: 썸머 바캉스 마켓", "[동대문문화재단] 2026 생생 국가유산 사업 [지구를 지키는 선농마켓]",
    "[서울디자인재단] DDP 상생마켓: 서울패션허브 SUMMER MARKET", "한강플플 그린마켓",
  ];
  const no = [
    "[서울공예박물관] 제2회 서울시 유리지공예상 기념전", "[서울공예박물관] 2026 SeMoCA공예강좌 #5",
    "[서울공예박물관] 공예동행@쇼윈도 #5. [사라진 뒤에도 이어지는길 The Path that Remains]", "[서울공예박물관] 현대공예 기증특별전 [에퀴녹스 : 추분_춘분]",
    "[서울공예박물관] 비밀요원 CMI: 두 번째 비밀코드 [1,2학년]", "[서울공예박물관] 나전함, 공예를 담다", "[서울공예박물관] 임페리얼 골드: 자수(3·4기)",
    "[서울공예박물관]2026 공예문화유산 보존복원 성과 시민 공개행사[TIMELESS CRAFT, 보존과 재현의 현장]", "2026 삼각산금암미술관 은평 공예 공모 선정자 展 [경외의 구조]",
    "[서울공예박물관] 공예별당 음악감상회: SeMoCA 한옥 리스닝 클럽", "[서울공예박물관] 7월 큐레이터와 함께하는 전시해설 | 《더 하이브리드》",
    "[마포구립서강도서관] 6-11월/길 위의 인문학 [독서 페어링：Allthat library to do]",
    "[서울문화예술교육센터 강북]상설프로젝트 《일상의 무대》 6월전통공예 워크숍 [복을 담은 장승목인형]",
    "[구립증산도서관] 가족열람실 7월 북큐레이션 [같이 읽자, 여름 먹거리]", "[서울공예박물관] 권순형 로드: 도자벽화 탐방",
    "[서울공예박물관] 색유만개 :권순형 기증특별전시", "[서울공예박물관] 공예협력전시 [안동별궁, 시간의 겹]",
  ];
  for (const name of yes) assert.equal(isSellerEvent(name), true, name);
  for (const name of no) assert.equal(isSellerEvent(name), false, name);
});

test("서울시 문화행사 정보: 기간·분류로 거르고 상세 정보를 함께 담는다", async () => {
  const { parseSeoulCultureRows } = await import("./weekly-sync");
  const row = (o: Record<string, string>) => ({
    CODENAME: "축제-기타", GUNAME: "마포구", TITLE: "망원 한강 플리마켓", STRTDATE: "2022-05-07 00:00:00.0", END_DATE: "2022-05-07 00:00:00.0",
    PLACE: "망원한강공원", ORG_NAME: "마포구청", USE_FEE: "", IS_FREE: "무료", ORG_LINK: "https://www.mapo.go.kr", MAIN_IMG: "http://culture.seoul.go.kr/a.jpg",
    PROGRAM: "셀러 40팀 참여", ETC_DESC: "", LAT: "126.9", LOT: "37.55", HMPG_ADDR: "https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=123456&menuNo=200009", ...o,
  });
  const out = parseSeoulCultureRows([
    row({}),
    row({ TITLE: "옛날 행사", STRTDATE: "2020-01-01 00:00:00.0", END_DATE: "2020-01-01 00:00:00.0", HMPG_ADDR: "cultcode=1" }),
    row({ CODENAME: "뮤지컬/오페라", TITLE: "마켓 이야기", HMPG_ADDR: "cultcode=2" }),
  ], "2021-10-01", "2026-10-06");
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceId, "C123456");
  assert.equal(out[0].lat, 37.55); // 위도·경도 칸이 바뀌어 와도 범위로 바로잡음
  assert.equal(out[0].imageUrl, "https://culture.seoul.go.kr/a.jpg");
  assert.deepEqual(out[0].details, { overview: "셀러 40팀 참여", place: "망원한강공원", sponsor: "마포구청", admission: "무료", homepage: "https://www.mapo.go.kr" });
});
