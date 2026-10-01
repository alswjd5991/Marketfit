# 마켓핏 (MarketFit)bbbbb

소상공인 행사 참가 데이터 플랫폼 — 전국 플리마켓·지역축제·팝업마켓 모집공고를 모으고,
참가 데이터를 축적해 "우리 가게는 어떤 행사에서 잘 팔리는가"를 데이터로 판단하게 돕는다.

개발 계획 전문(아키텍처·데이터 모델·수집 전략·로드맵)은 프로젝트 문서를 참고:
`소상공인 행사 참가 데이터 플랫폼 — 개발 계획` (Claude Docs)

이 프로젝트는 같은 폴더의 `chuljeom-app`(출점전, 통계최강자전 출품용 Streamlit 서비스)과는
별개의 신규 구축이다. chuljeom-app은 그대로 두고 손대지 않는다.

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 아래 "작업 파일 설정"을 참고해 키를 채운다
npm run dev                  # http://localhost:3000
```

### 로그인·회원가입에서 `fetch failed`가 나올 때

인증 요청은 브라우저가 아니라 개발 서버에서 Supabase로 전송된다. 화면이 열리더라도
개발 서버 실행 환경의 외부 네트워크가 차단되어 있으면 로그인과 회원가입이 모두 실패한다.
네트워크 접근이 가능한 터미널에서 서버를 다시 실행하고 `.env.local`의 Supabase URL과
공개 키 설정을 확인한다. 인증이나 이메일 확인을 끄는 방식으로 해결하지 않는다.
이메일 확인이 켜진 프로젝트는 가입 확인 메일의 링크를 누른 뒤 로그인해야 한다.

인증 오류 안내 테스트: `npx tsx --test src/features/auth/errors.test.ts`

다른 명령어:

```bash
npm run build       # 프로덕션 빌드(배포 전 에러 확인용)
npm run start        # 빌드된 결과를 로컬에서 실행
npm run lint          # ESLint 검사
npm run seed:events   # 시드 행사 데이터(42건)를 Supabase에 적재(최초 1회, 재실행해도 안전)
```

## 현재 상태 (2026-09-26 기준)

핵심 기능(Phase 1~5)이 전부 구현돼 있고, DB 마이그레이션 2개(`0001_init.sql`, `0002_vendor_profile_fields.sql`)가
Supabase에 모두 적용된 상태다.

- **`/events`, `/events/[id]` — 행사 찾기**: `src/lib/data/seed-events.ts`의 실제 공개 자료 42건(서울 27 + 파일럿 15,
  이름·시작일 기준 중복 제거)을 직접 읽는다. Supabase의 `events`/`event_recruitments`와는
  `source_post_id` 키로 연결돼 있지만, 목록·상세 화면 자체는 아직 정적 시드 파일을 읽는 구조다(의도적 보류 — 아래
  "폴더 구조" 참고). 행사 포스터는 원본 모집공고의 실제 이미지를 우선 쓰고(37/42건 확보), 없으면 카테고리별
  생성 그래픽으로 대체한다.
- **로그인/회원가입 (`/login`, `/signup`)**: Supabase Auth 이메일·비밀번호 방식. 이메일 확인이 켜져 있다.
- **`/store` — 내 가게**: 가게 등록/수정(이름·카테고리·닉네임·대표상품·활동지역·연락처·이메일·사업자등록번호·
  SNS링크·지원 결제수단·위생교육 이수 여부·대표 사진/로고), 상품 등록/삭제.
- **`/my-events`, `/my-events/[participationId]` — 내 행사 관리**: 행사 상세에서 "내 행사에 추가"를 누르면
  실제 DB에 참가 기록이 생긴다. 상세 페이지에서 참가 상태 변경, 참가 전 정보(참가비·예상매출·목표매출·부스
  제공방식/크기·전기/차량 이용가능 여부), 준비 체크리스트, 참가 후 결과(총매출·비용 4종·자동계산 순이익·만족도·
  날씨·실내외·재참가의향·부스 위치/번호·부스 위치 만족도·현장 결제수단·부스 사진·메모), 상품별 판매 실적까지
  전부 기록·수정할 수 있다.
- **`/dashboard` — 대시보드**: 참가/매출/순이익/만족도 통계 타일, 참가 상태·카테고리별 분포, 월별 참가 추이,
  행사별 매출·순이익 추이, 인기 품목 TOP 8. 기록이 없는 지표는 0으로 지어내지 않고 "아직 기록 없음"으로 표시한다.
- **`/ai` — AI 도우미**: Gemini 기반 채팅. 내 가게/참가/판매 데이터를 근거로 본인 질문에 답하고(검색 없이,
  DB 기록만 근거), 일반적인 질문은 구글 검색 그라운딩으로 답하며 출처 링크를 함께 보여준다. `GEMINI_API_KEY`가
  없으면 화면에 안내 배너가 뜨고 동작하지 않는다 — 설정 방법은 아래 "AI 도우미(Gemini) 연동" 참고.

**아직 안 된 것**: 과거 공고 데이터 확충(42건 → 100건 목표), 포스터 사진 미확보 5건, RAG 지식베이스(현재는
구글 검색 그라운딩이 어느 정도 대체), `events` 화면의 완전한 DB 전환. 자세한 진행 상황과 다음 할 일은 Claude
프로젝트 문서 `Marketfit_작업현황.md`에 세션 단위로 기록돼 있다.

## 사용법 — GitHub Desktop으로 협업하기

이 저장소는 GitHub(`https://github.com/alswjd5991/Marketfit.git`)에서 관리하고, 코드 수정은 로컬 에디터(VS Code 등)로,
버전 관리(커밋/푸시/PR)는 **GitHub Desktop**으로 하는 걸 기준으로 한다. 아래는 처음부터 끝까지 흐름이다.

### 1. GitHub Desktop 설치 및 로그인

1. [desktop.github.com](https://desktop.github.com)에서 설치 파일을 받아 설치한다.
2. 처음 실행하면 GitHub 계정으로 로그인하라는 화면이 뜬다 — 저장소에 접근 권한이 있는 계정으로 로그인한다.
3. 로그인 후 왼쪽 상단 "File" → "Options"(Mac은 "Preferences")에서 Git 사용자 이름/이메일이 본인 것으로
   설정돼 있는지 확인한다(커밋 기록에 남는 정보).

### 2. 저장소 클론(처음 한 번만)

1. GitHub Desktop 상단 "File" → "Clone repository..."
2. "URL" 탭에서 `https://github.com/alswjd5991/Marketfit.git` 입력(또는 "GitHub.com" 탭에서 목록에 보이면 선택)
3. "Local path"를 원하는 폴더로 지정하고 "Clone" 클릭
   - 이미 로컬에 `Marketfit` 폴더가 있다면(예: `C:\Users\82105\Desktop\아름다운 프로젝트\26-2 통최전\Marketfit`)
     새로 클론할 필요 없이 "File" → "Add local repository..."로 그 폴더를 등록하면 된다.

### 3. 브랜치 확인/전환

1. GitHub Desktop 상단 가운데 "Current branch" 드롭다운을 클릭하면 로컬/원격 브랜치 목록이 보인다.
2. **이 프로젝트는 현재 `main`이 아니라 `minjeong` 브랜치에서 작업 중이다.** 목록에서 `minjeong`을 선택해
   체크아웃한다. 목록에 안 보이면 "Fetch origin"을 먼저 눌러 원격 브랜치 정보를 갱신한다.
3. 화면 상단에 "Current branch: minjeong"으로 표시되면 정상이다. 다른 작업으로 넘어가기 전엔 항상 이
   표시를 먼저 확인하는 습관을 들이면 좋다 — 엉뚱한 브랜치에 커밋하는 실수를 막아준다.

### 4. 코드 수정

1. VS Code 등 원하는 에디터로 클론된 `Marketfit` 폴더를 연다.
2. `src/app`(화면 배치), `src/features`(기능별 로직: events/participations/dashboard/store/ai),
   `src/components/ui`(공용 UI 부품) 구조를 따라 필요한 파일을 수정한다 — 자세한 구조는 아래 "폴더 구조" 참고.
3. 로컬에서 `npm run dev`로 `http://localhost:3000`을 띄워놓고 바로바로 확인하며 작업하는 걸 추천한다.
4. 저장하면 GitHub Desktop 왼쪽 "Changes" 탭에 변경된 파일 목록과 diff(빨간줄/초록줄)가 실시간으로 뜬다.

### 5. Commit(커밋)

1. GitHub Desktop 왼쪽 "Changes" 탭에서 커밋에 포함할 파일들을 체크한다(기본은 전체 체크).
2. 왼쪽 하단 "Summary" 칸에 무엇을 왜 바꿨는지 한 줄로 쓴다(예: "가게 프로필에 SNS 링크 필드 추가").
   필요하면 "Description" 칸에 더 자세히 적어도 된다.
3. "Commit to minjeong" 버튼 클릭 — 이 순간 로컬 저장소에만 기록되고, 아직 GitHub 서버(원격)로는 안 올라간다.
4. 작업 단위가 끝날 때마다 이 과정을 반복해도 된다(한 번에 몰아서 커밋하지 않아도 됨).

### 6. Push(푸시)

1. 커밋을 끝냈으면 화면 상단의 "Push origin" 버튼을 클릭한다(커밋이 로컬에만 있으면 이 버튼이 "Push origin ↑숫자"로 표시된다).
2. 이 순간 로컬 커밋들이 GitHub 서버의 `minjeong` 브랜치로 올라간다. 다른 팀원도 이제 이 변경사항을 볼 수 있다.
3. 만약 그사이 다른 사람이 같은 브랜치에 먼저 푸시했다면 버튼이 "Fetch origin" 또는 "Pull origin"으로 바뀐다 —
   먼저 Pull로 원격 변경사항을 받아온 뒤(충돌이 있으면 GitHub Desktop이 알려준다) 다시 Push한다.

### 7. Pull Request(PR) 만들기

`minjeong` 브랜치의 변경사항을 `main`(또는 팀에서 정한 기준 브랜치)에 합치고 싶을 때 PR을 연다.

1. GitHub Desktop 상단 "Branch" 메뉴 → "Create Pull Request"를 클릭하면 기본 브라우저로 GitHub PR 생성 화면이 열린다.
2. "base: main" ← "compare: minjeong"으로 방향이 맞는지 확인한다(보통 자동으로 맞춰져 있다).
3. 제목과 설명에 이번 변경사항 요약을 적는다(커밋 메시지들을 참고해서 정리하면 편하다).
4. "Create pull request" 클릭. 팀원이 있다면 리뷰를 요청해도 좋다.

### 8. Merge(병합)

1. PR 화면 하단으로 스크롤하면 "Merge pull request" 버튼이 있다(충돌이 있으면 이 버튼 대신 충돌 해결 안내가 뜬다).
2. 버튼을 눌러 병합하면 `minjeong`의 변경사항이 `main`에 합쳐진다.
3. 병합 후 GitHub Desktop에서 "Current branch"를 `main`으로 바꾸고 "Fetch origin" → "Pull origin"을 하면
   로컬 `main`도 최신 상태가 된다.
4. 이후 새 작업을 시작할 땐 다시 `minjeong`(또는 새 기능 브랜치)으로 전환해서 진행한다.

> **충돌(conflict)이 났을 때**: GitHub Desktop이 충돌난 파일을 표시해준다. "Open in [에디터]"를 눌러 해당 파일을
> 열면 `<<<<<<<`, `=======`, `>>>>>>>` 표시로 양쪽 변경사항이 다 보인다 — 둘 중 남길 내용을 직접 정리하고 그 표시들을
> 지운 뒤 저장, 다시 GitHub Desktop으로 돌아와 "Continue merge"를 누르면 된다. 확신이 안 서면 무리해서 혼자 풀려고
> 하지 말고 팀원과 같이 보는 걸 추천한다.

## 작업 파일 설정 (.env.local)

`.env.local`은 절대 GitHub에 올리면 안 되는 비밀 값들이라 `.gitignore`에 이미 등록돼 있다(커밋 목록에 뜨면 안 됨).
`.env.example`을 복사해서 만들고 아래 값들을 채운다.

```bash
cp .env.example .env.local
```

| 변수 | 필수 여부 | 어디서 구하나 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | Supabase 대시보드 → 해당 프로젝트 → Project Settings → API → "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 | 같은 화면의 "anon public" 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수(시딩 스크립트용) | 같은 화면의 "service_role" 키 — **절대 `NEXT_PUBLIC_` 접두어를 붙이거나 브라우저/클라이언트 코드에 노출하면 안 된다.** 서버 전용. |
| `GEMINI_API_KEY` | 선택(없으면 AI 도우미만 비활성화) | 아래 "AI 도우미(Gemini) 연동" 참고 |
| `TOUR_API_KEY` | 선택(없으면 서울 외 지역은 Marketfit 행사 부족 시 웹 검색으로만 보충) | [공공데이터포털 한국관광공사_국문 관광정보 서비스](https://www.data.go.kr/data/15101578/openapi.do) 활용신청 후 발급되는 일반 인증키(Encoding/Decoding 둘 다 가능) |
| `DATA_GO_KR_KEY` | 선택 | 공공데이터 수집 단계(향후 작업)에서나 필요 — 지금은 안 써도 됨 |

값을 채운 뒤엔 개발 서버를 재시작해야 반영된다(`npm run dev` 다시 실행).

## AI 도우미(Gemini) 연동

`/ai` 채팅 화면은 Google Gemini API(REST `generateContent`)를 호출한다. 키가 없어도 앱 자체는 정상 실행되고,
`/ai` 화면에만 "API 키가 연결되지 않았습니다" 같은 안내가 뜨고 답변이 동작하지 않는다.

### 키 발급 및 연결

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey)에 구글 계정으로 접속한다.
2. "Create API key" 클릭 → 새 프로젝트를 만들거나 기존 프로젝트를 선택해 키를 발급받는다.
3. 발급된 키를 복사해 `.env.local`의 `GEMINI_API_KEY=` 뒤에 붙여넣는다.
4. `npm run dev`를 재시작한다. `/ai` 화면 헤더의 상태점이 연결됨으로 바뀌면 정상이다.

### 동작 방식

- 매 턴마다 서버 액션이 **로그인한 사용자의 실제 가게 정보·상품·참가 기록·판매 실적**을 DB에서 모아
  Gemini의 systemInstruction에 근거 자료로 넣어준다(`src/features/ai/data.ts`의 `buildStoreContextSummary`).
- 질문을 두 갈래로 처리한다:
  - **본인 참가/매출 관련 질문**은 위 DB 근거 자료만 보고 답한다(검색 안 함) — DB에 없는 숫자·행사·상품은
    지어내지 않는다.
  - **일반적인 질문**(예: "요즘 플리마켓 트렌드 어때?")은 구글 검색 그라운딩(`tools: [{ google_search: {} }]`)으로
    실제 웹을 검색해 답하고, 참고한 페이지 링크를 답변 아래 출처로 보여준다.
- 대화 내용은 Supabase `chat_conversations`/`chat_messages` 테이블에 저장되고, RLS와 서버 액션의 이중 검증으로
  본인 대화만 보인다.
- 이미지/파일 업로드나 스트리밍 응답 같은 멀티모달 기능은 아직 없다(텍스트 전용으로 범위를 한정해 구현).

### 확인 방법

```bash
npm run test:ai    # API 호출 없이 모델 전환/검색 장애/시간 초과 등 회귀 테스트
npm run check:ai   # .env.local 키로 실제 API 2턴 진단 (API 사용량 발생)
npm run check:events # 실제 Marketfit DB → 서울시/TourAPI 행사 조회 순서 확인 (Gemini 호출/DB 변경 없음)
```

질문은 `reply.ts`에서 종류별로 나뉘어 다음 순서로 답한다.

1. **개인 질문**(내/우리 가게, 매출, 순이익, 참가한 행사, 만족도 등) → Marketfit에 저장된 본인 가게·참가·판매 기록.
   합계·평균·최고/최저·순위는 `stats.ts`가 코드로 계산해 넘기고, AI는 그 숫자를 설명·분석만 한다(웹 검색 없음).
   "내 가게에 맞는 행사 추천"처럼 행사가 섞이면 앞으로 60일간의 Marketfit 등록 행사도 함께 넘겨 그 안에서만 추천한다.
   가게 기록은 개인 질문일 때만 AI에 전달한다.
2. **행사·일정·모집 질문**("(시·도) + 기간 + 행사/모집") → `event-search.ts`
   1. Marketfit DB(`events` + `event_recruitments`): 모집 마감일·참가비를 함께 안내, 링크는 `/events/[id]`
   2. **3건 미만이면** 다른 웹사이트의 공식 목록으로 보충: 서울은 서울시 [공식 축제 찾기](https://festival.seoul.go.kr/festival/seasonal/list.do)
      → 한국관광공사 TourAPI `searchFestival2`, 그 외 지역·전국은 TourAPI(`TOUR_API_KEY` 필요). 모집 질문은 이 목록에 모집 정보가 없어 건너뛴다.
   3. **그래도 3건 미만이면** Gemini 구글 웹 검색으로 보충(검색이 안 되면 보충하지 않고 안내만 한다)
   - 답변은 "Marketfit에 등록된 행사" / "다른 웹사이트에서 가져온 행사 — 출처: …" / "다른 웹사이트에서 찾은 정보 — 출처: 구글 웹 검색" 구역으로 나누고,
     출처 링크에도 `[서울시]`, `[한국관광공사]`, `[웹 검색]`을 붙여 Marketfit 밖에서 가져온 정보임을 알린다.
   - 같은 행사는 이름(연도·회차·공백 제외)과 기간이 겹치면 한 번만 보여준다.
3. **그 외 일반 질문**(트렌드, 준비 방법 등) → Gemini 구글 웹 검색(가게 기록 없이)

행사 질문 판별(`parseEventQuery`):
- 기간: 한국 시간 기준 오늘/내일/모레, 이번 주/다음 주, (이번/다음) 주말, 이번 달/다음 달, 명시한 연·월. 기간 없는 모집 질문은 오늘부터 90일.
- 지역: 17개 시·도 또는 전국. 지역이 없으면 전국으로 본다.
- 주제어: 행사·축제·페스티벌·페스타·마켓·장터·야시장·벼룩·박람회·이벤트 / 모집어: 모집·셀러·신청·참가비·부스.
- "부산은?", "그럼 다음 달은?" 같은 짧은 후속 질문은 직전 질문의 조건을 이어받는다.
- 여러 지역, 시·군·구/동네/대학(강남구, 수원시, 해운대, 서울대 등), 개인 실적, 추천·비교, 공연·전시, 무료·유료·가격,
  특정 날짜("15일", "~부터") 질문은 목록만으로 정확히 답할 수 없어 AI 경로를 사용한다.

TourAPI의 `eventStartDate`/`eventEndDate`는 기간이 겹치는 행사를 돌려준다(2026-09-30 실측). 목록은 종료 행사를 뒤로,
조회 기간 안에 시작하는 행사를 상설 행사보다 앞에 정렬한다. 공식 사이트/API의 응답 구조가 바뀌면 어댑터 수정이 필요하다.

**행사 데이터 수집 자동화(예정, 아직 구축 안 함):** Marketfit DB의 최신성을 위해 매주 월요일마다 새 행사·모집 공고를
수집해 `events`/`event_recruitments`에 적재할 계획이다. 현재는 `npm run seed:events`(수동 시드)로만 적재한다.

그 외 질문에서 검색 도구를 포함한 요청이 실패하면 다른 후보 모델을 시도하고, 모두 실패하면 검색 없는
텍스트 생성으로 전환한다. 검색 없는 답변에는 최신 정보를 확인하지 못했다는 안내가 붙으며,
가게 기록과 일반 설명만 사용하고 최신 행사·가격·모집 여부는 확인 불가로 답하도록 지시한다.
이 안내도 답변과 함께 저장된다. 검색 연결 복구 후에는 다시 검색을 시도한다.

기본 후보는 `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`,
`gemini-3.1-flash-lite` 순서다. 필요하면 `GEMINI_MODELS`에 쉼표로 구분해 설정할 수 있다.
모델당 최대 10초, 검색 포함/미포함 단계당 최대 25초로 호출을 제한한다.
429/일시 서버 오류/네트워크 오류/사용 불가 모델은 다음 후보로 전환하지만 인증 오류는 즉시 알린다.
`Retry-After`와 Google `RetryInfo`에 따라 실패한 모델·검색 모드를 잠시 건너뛴다.
이 상태는 서버 프로세스 메모리에만 있어 재시작 시 초기화되고 여러 인스턴스 간에는 공유되지 않는다.

2026-09-29 진단에서는 검색 포함 요청이 세 후보에서 모두 429였지만, 검색 없는
`gemini-3.5-flash-lite`/`gemini-3.1-flash-lite` 요청은 200으로 성공했다.
따라서 모델 전환만으로 해결되지 않는 검색 연결 문제가 직접 확인되었다.
Google 오류에 quota 항목은 없어 정확한 검색 할당량/과금 조건은 AI Studio에서 별도로 확인해야 한다.
모든 텍스트 모델의 한도까지 소진되면 전환만으로 새 한도가 생기지는 않으므로, API 한도 회복이 필요하다.

`/ai`에서 "이번 달 매출 어때?" 같은 본인 데이터 질문과 "요즘 인기있는 마켓 트렌드 알려줘" 같은 일반 질문을
각각 던져보면 두 경로가 다르게 동작하는 걸 확인할 수 있다. 일반 질문 답변 아래 출처 링크가 붙는지도 함께 확인.

## 폴더 구조

```
src/app/               라우트(App Router) — page.tsx는 화면 배치만, 로직은 features/로
src/features/          events, participations, dashboard, store, ai, auth — 기능 단위 로직
src/components/ui/     shadcn 스타일의 공용 UI 프리미티브(Button/Card/Badge 등)
src/lib/supabase/      브라우저/서버용 Supabase 클라이언트
src/lib/data/          seed-events.ts — 행사 정적 시드 데이터, event-poster-manifest.json — 실제 포스터 이미지 URL
src/types/             손으로 유지 관리하는 DB 타입 — 반드시 `type`으로 선언할 것(`interface`로 바꾸면
                        Supabase insert/update 타입이 깨지는 버그가 있었음)
supabase/migrations/   SQL 스키마 — 0001_init.sql(기본 테이블), 0002_vendor_profile_fields.sql(가게/참가
                        프로필 확장 + vendor-images 스토리지 버킷·RLS)
src/proxy.ts            Next.js 16의 middleware.ts 대체 — Supabase 세션 갱신
scripts/seed-events.ts  시드 행사 데이터를 Supabase에 적재하는 스크립트(npm run seed:events)
```

## 알아둘 것

- **Next.js 16**: `middleware.ts`가 `proxy.ts`(export명 `proxy`)로 이름이 바뀌었다. training data 기준으로
  코드를 짤 때 `node_modules/next/dist/docs/`를 먼저 확인할 것(`AGENTS.md` 참고).
- **Prisma 대신 Supabase JS 클라이언트**: ORM 없이 `@supabase/supabase-js` + `@supabase/ssr` + 손으로 쓴 SQL
  마이그레이션으로 구성돼 있다.
- **이미지 업로드**: 가게 로고/부스 사진은 Supabase Storage의 `vendor-images`(public) 버킷에 저장한다.
  업로드 경로는 `{업로더 auth.uid()}/store-logo|booth-photo/{uuid}.{확장자}`로 강제되고, RLS로 본인 폴더에만
  쓸 수 있게 막혀 있다(읽기는 공개). 새 Client Component 없이 Server Action의 `FormData`/`File` 네이티브
  지원으로 구현했다(`src/features/store/actions.ts`의 `uploadVendorImage`).
- **데이터 원칙**(chuljeom-app의 원칙을 계승): 실제 공개 자료는 값을 지어내거나 빈칸을 추정으로 채우지 않는다.
  없는 조건은 "미기재"로 둔다. 테스트용 샘플 데이터는 반드시 `is_sample_data = true`로 표시하고, 실제 데이터인
  것처럼 섞지 않는다. 행사에 종합 점수·추천 순위를 매기지 않는다(근거 나열형 추천만). 같은 원칙으로, 이 앱이
  실제로 처리하지 않는 정보(정산 계좌, 보험, 신분증 번호 등)는 애초에 입력받지 않는다.
