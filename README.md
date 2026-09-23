# 마켓핏 (MarketFit)

소상공인 행사 참가 데이터 플랫폼 — 전국 플리마켓·지역축제·팝업마켓 모집공고를 모으고,
참가 데이터를 축적해 "우리 가게는 어떤 행사에서 잘 팔리는가"를 데이터로 판단하게 돕는다.

개발 계획 전문(아키텍처·데이터 모델·수집 전략·로드맵)은 프로젝트 문서를 참고:
`소상공인 행사 참가 데이터 플랫폼 — 개발 계획` (Claude Docs)

이 프로젝트는 같은 폴더의 `chuljeom-app`(출점전, 통계최강자전 출품용 Streamlit 서비스)과는
별개의 신규 구축이다. chuljeom-app은 그대로 두고 손대지 않는다.

## 실행

```bash
npm install
cp .env.example .env.local   # Supabase 키를 채운다
npm run dev                  # http://localhost:3000
```

## 현재 상태 (Phase 1 — 진행 중)

- Supabase 프로젝트가 아직 연결되지 않아, `/events`와 `/events/[id]`는
  `src/lib/data/seed-events.ts`의 **실제 공개 자료 42건**(chuljeom-app의
  서울 26건 + 파일럿 19건을 이름·시작일 기준 중복 제거해 병합)을 직접 읽는다.
- Supabase 프로젝트를 연결하면 `src/features/events/data.ts`의 `getEvents` /
  `getEventById` 구현만 Supabase 쿼리로 교체하면 된다 — 이 파일이 화면과 DB
  사이의 유일한 경계선이다.
- `/my-events`, `/dashboard`, `/ai`, `/store`는 아직 자리만 잡아둔 화면이다
  (각 페이지에 어느 Phase에서 구현될지 표시되어 있다). 동작하지 않는 버튼을
  두지 않기 위해 일부러 "준비 중"으로 명시했다.

## 폴더 구조

```
src/app/            라우트(App Router) — page.tsx는 화면 배치만, 로직은 features/로
src/features/       events, participations, dashboard, store, ai — 기능 단위 로직
src/components/ui/  shadcn 스타일의 공용 UI 프리미티브(Button/Card/Badge)
src/lib/supabase/   브라우저/서버용 Supabase 클라이언트
src/lib/data/       seed-events.ts — Supabase 연결 전 임시 실데이터
src/types/          손으로 유지 관리하는 DB 타입(추후 supabase gen types로 교체 가능)
supabase/migrations/ SQL 스키마(0001_init.sql) — Event/EventRecruitment 분리 포함
src/proxy.ts         Next.js 16의 middleware.ts 대체 — Supabase 세션 갱신
```

## 알아둘 것

- **Next.js 16**: `middleware.ts`가 `proxy.ts`(export명 `proxy`)로 이름이 바뀌었다.
  training data 기준으로 코드를 짤 때 `node_modules/next/dist/docs/`를 먼저 확인할 것
  (`AGENTS.md` 참고).
- **Prisma 대신 Supabase JS 클라이언트**: 이 개발 환경(샌드박스)은 Prisma의
  엔진 바이너리 다운로드(binaries.prisma.sh)가 네트워크 정책으로 막혀 있어
  `prisma generate`/`migrate`를 실행할 수 없었다. 그래서 ORM 없이
  `@supabase/supabase-js` + `@supabase/ssr` + 손으로 쓴 SQL 마이그레이션으로
  전환했다. 로컬 환경에서 Prisma를 다시 쓰고 싶다면 무방하다.
- **데이터 원칙**(chuljeom-app의 원칙을 계승): 실제 공개 자료는 값을 지어내거나
  빈칸을 추정으로 채우지 않는다. 없는 조건은 "미기재"로 둔다. 테스트용
  샘플 데이터는 반드시 `is_sample_data = true`로 표시하고, 실제 데이터인 것처럼
  섞지 않는다. 행사에 종합 점수·추천 순위를 매기지 않는다(근거 나열형 추천만).
