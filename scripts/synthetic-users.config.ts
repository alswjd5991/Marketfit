// 합성 셀러 유저 생성 설정 — 모든 수치에 출처(통계) 또는 "가정" 표시를 단다.
// 통계 수치는 아래 원문에서 직접 확인한 값만 쓴다. 출처를 바꾸면 SOURCES도 같이 고칠 것.

export const SEED = 20261001; // 같은 시드 → 누가 실행해도 같은 30명
export const USER_COUNT = 30;
export const EMAIL_DOMAIN = "synthetic.marketfit.test"; // 합성 유저 표시(실제 통계에서 제외할 때 이 도메인으로 거른다)

export const SOURCES = {
  industry2023: {
    title: "중소벤처기업부·통계청, 2023년 소상공인실태조사 잠정결과",
    url: "https://www.mss.go.kr/site/smba/ex/bbs/View.do?cbIdx=86&bcIdx=1057002&parentSeq=1057002",
  },
  age2020: {
    title: "중소벤처기업부, 2020년 소상공인실태조사 결과 (2020년 기준)",
    url: "https://m.iljarihub.or.kr/wescmobile/bbs/B0000005/view.do?nttId=7110&menuNo=300004&pageIndex=2189",
  },
  gender2018: {
    title: "소상공인실태조사 2018년 기준 (한국외식신문 '소상공인 실태조사 심층 분석' 인용)",
    url: "https://www.kfoodtimes.com/news/articleView.html?idxno=7726",
  },
} as const;

/** 대표자 성별 — 2018년 기준 소상공인실태조사(최신 공개 성별 수치를 찾지 못해 이 값을 쓴다). */
export const GENDER = { source: "gender2018", weights: { 여성: 45.7, 남성: 54.3 } } as const;

/** 대표자 연령 — 2020년 기준 소상공인실태조사. */
export const AGE = {
  source: "age2020",
  weights: { "20대 이하": 6.3, "30대": 13.5, "40대": 25.5, "50대": 32.2, "60대 이상": 22.6 },
} as const;

/**
 * 업종 — 2023년 소상공인실태조사 기업체 수 비중 중 행사 판매와 관련 있는 3개 업종만 남겨 다시 정규화한다.
 * (부동산업·건설업 등은 플리마켓 셀러가 될 수 없어 제외.)
 * 업종 → Marketfit 카테고리 연결과 업종 안에서 카테고리를 똑같이 나누는 것은 [가정]이다.
 */
export const INDUSTRY = {
  source: "industry2023",
  weights: { "도·소매업": 33.6, "숙박·음식점업": 13.3, "제조업": 9.3 },
  categories: {
    "도·소매업": ["패션", "액세서리", "생활용품", "반려동물", "농산물"],
    "숙박·음식점업": ["음식", "디저트"],
    "제조업": ["수공예"],
  },
} as const;

/** 주 활동 지역 — [가정] Marketfit에 등록된 행사의 시·도 분포에 비례(행사 찾기 기능을 시험할 수 있도록). */
export const REGION_FROM_EVENTS = true;

/**
 * 30명 중 앞 8명에게 덮어씌우는 경계 사례 시나리오 — 기능이 깨지기 쉬운 상황을 일부러 만든다.
 * 인구통계(성별·연령·업종)는 그대로 통계 쿼터를 따른다.
 */
export const EDGE_CASES = [
  "no_store", //          가게 미등록
  "no_participation", //  가게만 있고 참가 0건
  "single_attended", //   참가 완료 1건
  "heavy", //             참가 15건 이상
  "always_loss", //       참가비·비용이 커서 늘 적자
  "unrecorded_result", // 참가했지만 매출·비용을 안 적음
  "no_region", //         활동 지역 미입력
  "empty_checklist", //   참가 예정인데 체크리스트 0개
] as const;

// ---------------------------------------------------------------------------
// 아래는 공식 통계가 없어 [가정]으로 둔 값. 실제 셀러 인터뷰·설문이 생기면 교체한다.
// ---------------------------------------------------------------------------

/** [가정] 카테고리별 대표 상품과 가격 범위(원). 원가는 가격의 30~50%. */
export const PRODUCTS: Record<string, { names: string[]; price: [number, number] }> = {
  음식: { names: ["수제 떡볶이", "닭꼬치", "김밥 세트", "어묵꼬치", "호떡"], price: [3000, 9000] },
  디저트: { names: ["마카롱", "수제 쿠키", "휘낭시에", "약과", "다쿠아즈"], price: [2500, 6000] },
  농산물: { names: ["유기농 사과 1kg", "꿀 500g", "제철 딸기", "말린 고구마", "수제 잼"], price: [5000, 20000] },
  수공예: { names: ["도자기 머그", "라탄 바구니", "가죽 카드지갑", "향초", "뜨개 코스터"], price: [8000, 35000] },
  패션: { names: ["린넨 셔츠", "에코백", "니트 비니", "빈티지 스카프", "양말 세트"], price: [8000, 40000] },
  액세서리: { names: ["비즈 반지", "은 귀걸이", "헤어핀", "키링", "팔찌"], price: [5000, 25000] },
  생활용품: { names: ["천연 비누", "수세미", "디퓨저", "행주 세트", "핸드크림"], price: [4000, 18000] },
  반려동물: { names: ["수제 간식", "반려견 반다나", "고양이 장난감", "펫 쿠션", "산책 가방"], price: [5000, 30000] },
};

/** [가정] 행사 1회 결과를 만드는 범위. */
export const EVENT_RESULT = {
  prepared: [8, 30] as [number, number], // 상품별 준비 수량(15~60개로 했더니 하루 매출 중앙값이 82만 원·적자 1/64건으로 비현실적이라 낮춤)
  sellThrough: [0.3, 0.95] as [number, number], // 판매율
  weather: { 맑음: 0.6, 흐림: 0.25, 비: 0.15 } as Record<string, number>,
  weatherFactor: { 맑음: 1, 흐림: 0.85, 비: 0.6 } as Record<string, number>,
  feeWhenUnknown: [20000, 80000] as [number, number], // 모집 공고에 참가비가 없을 때
  transport: [5000, 30000] as [number, number],
  parking: [0, 10000] as [number, number],
};

/** [가정] 참가 예정 행사의 기본 준비 체크리스트. */
export const CHECKLIST = ["테이블·천막 준비", "가격표 출력", "카드 단말기 충전", "포장재 준비", "재고 확인", "거스름돈 준비"];
export const FOOD_CHECKLIST = ["위생교육 이수증 챙기기", "보냉백·아이스팩"];

/** [가정] 이름 생성용. 성씨는 통계청 2015 인구주택총조사 상위 성씨, 이름은 임의 조합(실존 인물과 무관). */
export const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
/** [가정] 세대별로 흔한 느낌의 이름(50대 이상 / 그 아래). 실존 인물과 무관한 조합. */
export const GIVEN_NAMES = {
  여성: {
    older: ["영숙", "정희", "미경", "은영", "순자", "경희", "혜숙", "미숙", "현숙", "선희"],
    younger: ["지은", "수민", "서연", "민지", "혜진", "유진", "지현", "다은", "예린", "하은"],
  },
  남성: {
    older: ["영수", "상철", "광수", "재석", "성호", "정호", "영호", "종민", "병철", "만수"],
    younger: ["민준", "현우", "지훈", "성민", "준호", "동현", "도윤", "태현", "우진", "건우"],
  },
};
