// 대시보드 분석 카드(서버 컴포넌트). 숫자는 모두 compute.ts가 계산한 요약값만 받는다.
//
// 글쓰기 기준(토스 UX 라이팅 원칙 참고 — 사용자 입장의 정보, 의미 없는 문장 빼기, 쉬운 말, 일관된 말투):
//   - 카드마다 결론 한 문장을 맨 위에(해요체), 핵심 숫자는 크게, 보조 설명은 짧게
//   - 신뢰구간·유의·보정 같은 통계 용어는 화면에 쓰지 않고 "범위", "아직 확실하지 않아요"로
//   - 계산 방법은 "어떻게 계산했나요?"를 눌러야 보이게 접어 둔다

import type { ReactNode } from "react";
import { STATUS_COLORS } from "@/components/ui/chart-colors";
import { josa } from "@/lib/josa";
import type { DashboardAnalytics } from "./data";
import { STOCK_RULES, type StockDiagnosis, type StockVerdict } from "./stock";
import { PLAN_RULES } from "./plan";

const SKY = "#9CCFEE";
const SKY_DARK = "#2F6FB8";
const CORAL = "#F2836B";
const GOOD = STATUS_COLORS.good;
const BAD = STATUS_COLORS.critical;

export function manwon(n: number): string {
  const v = n / 10000;
  return `${Math.abs(v) >= 10 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toString()}만원`;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const absPct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;

// ---------------------------------------------------------------------------
// 공통 카드
// ---------------------------------------------------------------------------

function Card({ headline, sub, children, how }: { headline: ReactNode; sub?: ReactNode; children?: ReactNode; how?: string[] }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/80 bg-white/90 p-6 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm sm:p-7">
      <h3 className="break-keep text-[19px] font-bold leading-snug tracking-[-0.02em] text-neutral-950">{headline}</h3>
      {sub && <p className="mt-1.5 break-keep text-[14px] leading-6 text-neutral-500">{sub}</p>}
      {children && <div className="mt-6">{children}</div>}
      {how && how.length > 0 && (
        <details className="group mt-6 border-t border-neutral-100 pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-neutral-500 hover:text-neutral-800">
            어떻게 계산했나요?
            <span className="transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <ul className="mt-3 space-y-1.5 text-[13px] leading-6 text-neutral-600">
            {how.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-2.5 size-1 shrink-0 rounded-full bg-neutral-400" />
                <span className="break-keep">{line}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: "good" | "bad" | "warn" | "plain" }) {
  const style = {
    good: "bg-[#E0EFE8] text-[#2F5F4B]",
    bad: "bg-[#FFE4DE] text-[#BE3A2A]",
    warn: "bg-[#FFEEDD] text-[#B4530A]",
    plain: "bg-neutral-100 text-neutral-600",
  }[tone];
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${style}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// ①② 다가올 행사
// ---------------------------------------------------------------------------

export function ForecastPanel({ forecast }: { forecast: DashboardAnalytics["forecast"] }) {
  if (forecast.status === "hidden") {
    return <Card headline="아직 예상 매출을 알려 드리기엔 기록이 부족해요" sub="참가 기록이 쌓이면 다가올 행사의 예상 매출을 보여 드릴게요." />;
  }
  const { items, validation } = forecast;
  const shown = items.filter((i) => i.prediction.ok);
  const first = shown[0];
  const max = Math.max(1, ...shown.map((i) => (i.prediction.ok ? i.prediction.high : 0)), ...shown.map((i) => i.breakEven ?? 0)) * 1.05;
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const headline = !items.length
    ? "참가할 행사를 추가하면 예상 매출을 알려 드려요"
    : first?.prediction.ok
      ? <>{first.eventName}에서 <span className="text-brand">{manwon(first.prediction.median)}</span>쯤 팔 것 같아요</>
      : "다가올 행사는 아직 예상하기 어려워요";

  return (
    <Card
      headline={headline}
      sub={items.length ? "실제 매출은 보통 막대 범위 안에 들어와요." : undefined}
      how={[
        "내 지난 매출과, 비슷한 행사에서 다른 셀러들이 판 매출을 함께 봐요. 내 기록이 적을수록 다른 셀러들의 평균을 더 참고해요.",
        `지난 기록 ${validation.n.toLocaleString()}건으로 미리 맞혀 봤더니, 실제 매출이 범위 안에 ${pct(validation.coverage)} 들어왔어요.`,
        "손해 볼 확률은 참가비·평소 교통비 등과 상품 원가를 빼고 남는 돈이 0보다 적을 가능성이에요.",
      ]}
    >
      {items.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {items.map((it) => (
            <li key={`${it.eventName}-${it.startDate}`} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{it.eventName}</p>
                  <p className="mt-0.5 text-[13px] text-neutral-500">{Number(it.startDate.slice(5, 7))}월 {Number(it.startDate.slice(8))}일</p>
                </div>
                {it.prediction.ok ? (
                  <div className="shrink-0 text-right">
                    <p className="text-[22px] font-extrabold leading-tight tabular-nums text-neutral-950">{manwon(it.prediction.median)}</p>
                    <p className="text-[13px] tabular-nums text-neutral-500">보통 {manwon(it.prediction.low)}~{manwon(it.prediction.high)}</p>
                  </div>
                ) : (
                  <p className="shrink-0 text-[13px] text-neutral-400">예상하기 어려워요</p>
                )}
              </div>
              {it.prediction.ok && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-2 flex-1 rounded-full bg-neutral-100" aria-label={`보통 ${manwon(it.prediction.low)}에서 ${manwon(it.prediction.high)}`}>
                    <div className="absolute inset-y-0 rounded-full" style={{ left: x(it.prediction.low), width: `calc(${x(it.prediction.high)} - ${x(it.prediction.low)})`, background: SKY }} />
                    <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: x(it.prediction.median), background: SKY_DARK }} />
                    {it.breakEven != null && <div className="absolute -inset-y-1 w-0.5 rounded" style={{ left: x(it.breakEven), background: CORAL }} title={`본전 ${manwon(it.breakEven)}`} />}
                  </div>
                  {it.lossProbability != null ? (
                    <Chip tone={it.lossProbability >= 0.3 ? "bad" : it.lossProbability >= 0.1 ? "warn" : "good"}>
                      손해 볼 확률 {it.lossProbability < 0.01 ? "1% 미만" : pct(it.lossProbability)}
                    </Chip>
                  ) : (
                    <Chip tone="plain">참가비를 적으면 손해 확률도 보여 드려요</Chip>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {shown.some((i) => i.breakEven != null) && (
        <p className="mt-4 flex items-center gap-1.5 text-[13px] text-neutral-500">
          <span className="inline-block h-3 w-0.5 rounded" style={{ background: CORAL }} />
          본전(비용을 메우는 매출)
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ③ 매출이 달라진 조건
// ---------------------------------------------------------------------------

export function FactorPanel({ factors }: { factors: DashboardAnalytics["factors"] }) {
  if (factors.status !== "ok") {
    return <Card headline="어떤 날 더 팔렸는지는 기록이 더 모이면 알려 드려요" sub="셀러들의 참가 기록과 행사 수가 늘어나면 분석할 수 있어요." />;
  }
  const sure = factors.effects.filter((e) => e.significant).sort((a, b) => Math.abs(Math.log(1 + b.pct)) - Math.abs(Math.log(1 + a.pct)));
  const unsure = factors.effects.filter((e) => !e.significant);
  const top = sure[0];
  const maxLog = Math.max(Math.log(1.3), ...sure.map((e) => Math.abs(Math.log(1 + e.pct))));
  const width = (p: number) => `${(Math.abs(Math.log(1 + p)) / maxLog) * 50}%`;

  return (
    <Card
      headline={top ? <>{top.label}엔 {top.reference}보다 <span style={{ color: top.pct > 0 ? GOOD : BAD }}>{absPct(top.pct)} {top.pct > 0 ? "더" : "덜"}</span> 팔렸어요</> : "아직 매출이 확실하게 달라진 조건은 없어요"}
      sub="같은 가게가 조건만 달랐을 때 매출이 얼마나 달랐는지 봤어요."
      how={[
        "가게마다 파는 물건과 가격이 달라서, 같은 가게의 기록끼리만 비교했어요.",
        `셀러 ${factors.stores}곳이 행사 ${factors.events}곳에 참가한 기록 ${factors.n.toLocaleString()}건을 썼어요.`,
        "우연히 생겼을 수도 있는 차이는 '아직 확실하지 않아요'로 따로 묶었어요.",
        "함께 나타난 차이일 뿐, 비가 매출을 줄인 '원인'이라고 단정할 수는 없어요.",
      ]}
    >
      {sure.length > 0 && (
        <ul className="space-y-4">
          {sure.map((e) => (
            <li key={e.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold text-neutral-900">
                  {e.label} <span className="text-[13px] font-normal text-neutral-400">· {josa(e.reference, "과", "와")} 비교</span>
                </p>
                <p className="shrink-0 text-[17px] font-bold tabular-nums" style={{ color: e.pct > 0 ? GOOD : BAD }}>
                  {e.pct > 0 ? "+" : "−"}{absPct(e.pct)}
                </p>
              </div>
              {/* 가운데(0)에서 좌우로 뻗는 막대: 오른쪽 = 더 팔림, 왼쪽 = 덜 팔림 */}
              <div className="relative mt-2 h-2.5 rounded-full bg-neutral-100">
                <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-300" />
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{ [e.pct > 0 ? "left" : "right"]: "50%", width: width(e.pct), background: e.pct > 0 ? GOOD : BAD, opacity: 0.85 }}
                />
              </div>
              <p className="mt-1 text-[12px] tabular-nums text-neutral-400">
                대략 {e.low > 0 ? "+" : e.low < 0 ? "−" : ""}{absPct(e.low)} ~ {e.high > 0 ? "+" : e.high < 0 ? "−" : ""}{absPct(e.high)} 사이
              </p>
            </li>
          ))}
        </ul>
      )}
      {unsure.length > 0 && (
        <p className={`${sure.length ? "mt-5 border-t border-neutral-100 pt-4" : ""} break-keep text-[14px] leading-6 text-neutral-500`}>
          <span className="font-semibold text-neutral-700">{josa(unsure.map((e) => e.label).join(" · "), "은", "는")}</span>
          {" 아직 차이가 확실하지 않아요."}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ⑤ 준비 수량
// ---------------------------------------------------------------------------

const VERDICT: Record<StockVerdict, { label: string; tone: "good" | "bad" | "warn" | "plain" }> = {
  under: { label: "조금 더 준비해요", tone: "bad" },
  over: { label: "조금 줄여도 돼요", tone: "warn" },
  ok: { label: "큰 차이 없어요", tone: "good" },
  few: { label: "기록이 더 필요해요", tone: "plain" },
  noCost: { label: "원가를 적어 주세요", tone: "plain" },
};

function stockHeadline(items: StockDiagnosis[]): ReactNode {
  const under = items.find((i) => i.verdict === "under");
  const over = items.find((i) => i.verdict === "over");
  if (under) return <>{josa(under.productName, "은", "는")} 자주 다 팔렸어요. 다음엔 <span style={{ color: BAD }}>조금 더</span> 준비해 보세요</>;
  if (over) return <>{josa(over.productName, "은", "는")} 자주 남았어요. <span style={{ color: "#B4530A" }}>조금 줄여도</span> 괜찮아요</>;
  if (items.some((i) => i.verdict === "ok")) return "지금 준비하는 양에 큰 문제는 없어 보여요";
  return "준비 수량은 기록이 더 쌓이면 알려 드려요";
}

export function StockPanel({ stock }: { stock: DashboardAnalytics["stock"] }) {
  if (!stock.applicable) {
    return <Card headline="준비 수량 진단은 당일에 팔아야 하는 상품에만 해요" sub={`${stock.category || "이 카테고리"} 상품은 남아도 다음 행사에 다시 팔 수 있어서 진단하지 않아요.`} />;
  }
  if (stock.items.length === 0) {
    return <Card headline="상품별로 준비한 수량과 판 수량을 적어 주세요" sub="행사가 끝난 뒤 기록하면 다음 행사에 얼마나 준비할지 알려 드려요." />;
  }
  return (
    <Card
      headline={stockHeadline(stock.items)}
      sub="당일에 못 팔면 버려야 하는 상품이라, 너무 많이도 너무 적게도 준비하지 않는 게 중요해요."
      how={[
        "가격에서 원가가 차지하는 비율만큼은 다 팔리는 날이 있어야 가장 이득이에요. 원가가 가격의 30%라면 10번 중 3번쯤 다 팔리는 게 적당해요.",
        "실제로 다 팔린 횟수가 이보다 많으면 '더 준비', 적으면 '줄여도 돼요'라고 알려 드려요.",
        `기록이 ${STOCK_RULES.minEvents}번 이상 있고, 차이가 우연이라고 보기 어려울 때만 알려 드려요. 단골이 그냥 돌아가는 손해는 계산에 넣지 않았어요.`,
      ]}
    >
      <ul className="divide-y divide-neutral-100">
        {stock.items.map((it) => {
          const v = VERDICT[it.verdict];
          return (
            <li key={it.productName} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-neutral-900">{it.productName}</p>
                <p className="mt-0.5 text-[13px] tabular-nums text-neutral-500">
                  {it.stockouts === 0 ? `${it.n}번 모두 남음` : `${it.n}번 중 ${it.stockouts}번 다 팔림`}{(it.verdict === "under" || it.verdict === "over") && it.optimalRate != null && ` · 적당한 건 ${Math.round(it.optimalRate * it.n)}번쯤`}
                </p>
              </div>
              <Chip tone={v.tone}>{v.label}</Chip>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ⑦ 예상 매출 정확도 · ④ 같은 업종 비교 (수익성 카드 안의 한 줄)
// ---------------------------------------------------------------------------

export function PlanLine({ plan }: { plan: DashboardAnalytics["plan"] }) {
  if (plan.status !== "ok") {
    return <p className="text-[13px] text-neutral-400">예상 매출을 {PLAN_RULES.minPairs}번 이상 적으면, 얼마나 잘 맞혔는지 알려 드려요 (지금 {plan.n}번)</p>;
  }
  if (!plan.biased) return <p className="text-[13px] text-neutral-600">참가 전에 적은 예상 매출이 대체로 잘 맞았어요</p>;
  return (
    <p className="text-[13px] text-neutral-600">
      실제 매출이 예상보다 평균 <span className="font-bold text-neutral-900">{absPct(plan.pct)} {plan.pct < 0 ? "적었어요" : "많았어요"}</span>
    </p>
  );
}

export function PeerLine({ peer }: { peer: DashboardAnalytics["peer"] }) {
  if (peer.status !== "ok") return null;
  return (
    <p className="text-[13px] text-neutral-600">
      {peer.category} 가게 {peer.peers}곳 중 <span className="font-bold text-neutral-900">상위 {Math.max(1, Math.round((1 - peer.below) * 100))}%</span>예요
    </p>
  );
}

// ---------------------------------------------------------------------------
// 이 분석은 어떻게 만들었나요?
// ---------------------------------------------------------------------------

export function MethodsNote({ analytics }: { analytics: DashboardAnalytics }) {
  const { data } = analytics;
  return (
    <details className="group mt-10 rounded-2xl border border-white/80 bg-white/70 p-5 backdrop-blur-sm sm:p-6">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[15px] font-semibold text-neutral-800">
        이 분석은 어떻게 만들었나요?
        <span className="text-neutral-400 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <ul className="mt-4 space-y-2.5 text-[14px] leading-6 text-neutral-600">
        {data.syntheticRecords > 0 && (
          <li className="break-keep">
            <span className="font-semibold text-neutral-800">지금 보이는 숫자는 기능을 시험하려고 만든 가상 셀러의 기록</span>(참가 기록 {data.records.toLocaleString()}건 중{" "}
            {data.syntheticRecords.toLocaleString()}건)으로 계산했어요. 실제 시장의 모습으로 받아들이면 안 돼요.
          </li>
        )}
        <li className="break-keep">다른 셀러의 기록은 평균 같은 요약값으로만 쓰고, 다른 가게의 기록이 그대로 보이지는 않아요.</li>
        <li className="break-keep">기록이 부족하거나 우연과 구분되지 않으면, 결과를 보여 드리지 않거나 &quot;아직 확실하지 않아요&quot;라고 표시해요.</li>
        <li className="break-keep">정답을 알고 있는 가상 데이터로 수백 번 시험해서, 계산이 맞는지 확인했어요.</li>
      </ul>
      <p className="mt-4 text-[12px] leading-5 text-neutral-400">
        사용한 방법: 가게 고정효과 회귀(군집-강건 표준오차·다중비교 보정), 경험적 베이즈 축소 추정, conformal 예측구간, 뉴스벤더 최적 조건의 정확 이항검정
      </p>
    </details>
  );
}
