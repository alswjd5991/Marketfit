// 대시보드 분석 패널(서버 컴포넌트). 숫자는 모두 data.ts가 계산한 요약값만 받는다.

import { Empty, Panel } from "@/features/dashboard/panel";
import { STATUS_COLORS } from "@/components/ui/chart-colors";
import type { DashboardAnalytics } from "./data";
import { FACTOR_RULES } from "./factors";
import { FORECAST_RULES } from "./forecast";
import { PEER_RULES } from "./peer";
import { PLAN_RULES } from "./plan";
import { STOCK_RULES, type StockVerdict } from "./stock";

const SKY = "#7DBFE8";
const SKY_DARK = "#2F6FB8";
const CORAL = "#F2836B";
const MUTED = "#B8C2CC";

export function manwon(n: number): string {
  const v = n / 10000;
  return `${Math.abs(v) >= 10 ? Math.round(v).toLocaleString() : v.toFixed(1)}만원`;
}
const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const signedPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.round(Math.abs(x) * 100)}%`;

function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-xs leading-5 text-neutral-500">{children}</p>;
}

// ---------------------------------------------------------------------------
// ①② 다가올 행사 예측
// ---------------------------------------------------------------------------

export function ForecastPanel({ forecast }: { forecast: DashboardAnalytics["forecast"] }) {
  if (forecast.status === "hidden") {
    return (
      <Panel title="다가올 행사 예상 매출">
        <Empty>예측 보류 — {forecast.reason}</Empty>
      </Panel>
    );
  }
  const { items, validation } = forecast;
  const shown = items.filter((i) => i.prediction.ok);
  const max = Math.max(1, ...shown.map((i) => (i.prediction.ok ? i.prediction.high : 0)), ...shown.map((i) => i.breakEven ?? 0)) * 1.05;
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`;

  return (
    <Panel title="다가올 행사 예상 매출">
      {items.length === 0 ? (
        <Empty>참가 예정 행사 없음 — 내 행사에 추가하면 예상 매출 표시</Empty>
      ) : (
        <ul className="flex flex-col gap-5">
          {items.map((it) => (
            <li key={`${it.eventName}-${it.startDate}`} className="grid gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_88px] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-neutral-900">{it.eventName}</p>
                <p className="text-xs text-neutral-500">
                  {it.startDate.slice(5).replace("-", "/")}
                  {it.prediction.ok && ` · 중앙값 ${manwon(it.prediction.median)} (80% 구간 ${manwon(it.prediction.low)}~${manwon(it.prediction.high)})`}
                </p>
              </div>
              {it.prediction.ok ? (
                <div className="relative h-7" aria-label={`80% 예측구간 ${manwon(it.prediction.low)}에서 ${manwon(it.prediction.high)}`}>
                  <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-200" />
                  <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full" style={{ left: x(it.prediction.low), width: `calc(${x(it.prediction.high)} - ${x(it.prediction.low)})`, background: SKY }} />
                  <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: x(it.prediction.median), background: SKY_DARK }} />
                  {it.breakEven != null && (
                    <div className="absolute inset-y-0 w-0 border-l-2 border-dashed" style={{ left: x(it.breakEven), borderColor: CORAL }} title={`손익분기 ${manwon(it.breakEven)}`} />
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-400">{it.prediction.reason}</p>
              )}
              <div className="text-right">
                {it.lossProbability != null ? (
                  <>
                    <p className="text-[11px] text-neutral-500">적자 확률</p>
                    <p className="text-lg font-bold tabular-nums" style={{ color: it.lossProbability >= 0.3 ? STATUS_COLORS.critical : "#1F2023" }}>
                      {it.lossProbability < 0.01 ? "1% 미만" : pct(it.lossProbability)}
                    </p>
                  </>
                ) : (
                  it.prediction.ok && <p className="text-[11px] text-neutral-400">{it.costNote}</p>
                )}
                {it.lossProbability != null && it.costNote && <p className="text-[10px] leading-3 text-neutral-400">{it.costNote}</p>}
              </div>
              {it.prediction.ok && it.prediction.note && <p className="text-[11px] text-neutral-400 sm:col-span-3">{it.prediction.note}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full" style={{ background: SKY }} />80% 예측구간</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: SKY_DARK }} />중앙값</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0 border-l-2 border-dashed" style={{ borderColor: CORAL }} />손익분기 매출</span>
      </div>
      <Footnote>
        내 매출 기록과 비슷한 가게들의 기록을 함께 써서 추정(기록이 적을수록 전체 평균 쪽으로 보정). 날씨는 미리 알 수 없어
        구간 폭에 포함. 구간은 과거 예측 오차의 실제 분포로 정함. 검증: 과거 기록 {validation.n}건을 하나씩 빼고 예측해, 다른 가게들로 정한
        80% 구간이 실제 매출을 {pct(validation.coverage)} 포함, 중앙값 오차는 보통 ±{pct(validation.medianAbsPctError)}. 적자 확률은 참가비·평균 부대비용·상품 원가율 기준.
      </Footnote>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// ③ 매출 요인
// ---------------------------------------------------------------------------

export function FactorPanel({ factors }: { factors: DashboardAnalytics["factors"] }) {
  if (factors.status !== "ok") {
    return (
      <Panel title="매출이 달랐던 조건">
        <Empty>분석 보류 — {factors.reason}</Empty>
      </Panel>
    );
  }
  const ln = (p: number) => Math.log(1 + p);
  const lo = Math.min(ln(-0.2), ...factors.effects.map((e) => ln(e.low))) - 0.05;
  const hi = Math.max(ln(0.25), ...factors.effects.map((e) => ln(e.high))) + 0.05;
  const x = (p: number) => `${((ln(p) - lo) / (hi - lo)) * 100}%`;
  const ticks = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 1, 2].filter((t) => ln(t) > lo && ln(t) < hi);

  return (
    <Panel title="매출이 달랐던 조건">
      <ul className="flex flex-col gap-3">
        {factors.effects.map((e) => {
          const color = !e.significant ? MUTED : e.pct > 0 ? STATUS_COLORS.good : STATUS_COLORS.critical;
          return (
            <li key={e.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[150px_minmax(0,1fr)_120px]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{e.label}</p>
                <p className="truncate text-[11px] text-neutral-400">{e.reference} 대비 · {e.count}건</p>
              </div>
              <div className="relative order-3 col-span-2 h-6 sm:order-none sm:col-span-1">
                <div className="absolute inset-y-0 w-px bg-neutral-300" style={{ left: x(0) }} />
                <div className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: x(e.low), width: `calc(${x(e.high)} - ${x(e.low)})`, background: color }} />
                <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: x(e.pct), background: color }} />
              </div>
              <p className="text-right text-sm tabular-nums" style={{ color: e.significant ? color : "#8A8D93" }}>
                <span className="font-bold">{signedPct(e.pct)}</span>
                <span className="ml-1 text-[11px] text-neutral-400">({signedPct(e.low)}~{signedPct(e.high)})</span>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="relative mt-1 h-4 text-[10px] text-neutral-400 sm:ml-[calc(150px+0.75rem)] sm:mr-[calc(120px+0.75rem)]">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>{signedPct(t)}</span>
        ))}
      </div>
      <Footnote>
        같은 가게가 조건만 달랐을 때 매출이 평균 몇 % 달랐는지(가게 고정효과 회귀, 점 = 추정값, 선 = 95% 신뢰구간).
        회색은 여러 조건을 함께 검정한 보정(Holm) 후 우연과 구분되지 않는 차이. 기록 {factors.n}건 · 가게 {factors.stores}곳 · 행사 {factors.events}곳.
        관찰 자료라 인과관계가 아니라 함께 나타난 차이이며, 셀러가 날씨를 보고 참가를 정하는 등의 선택은 통제하지 못함.
        {factors.notes.length > 0 && ` ${factors.notes.join(" · ")}.`}
      </Footnote>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// ⑤ 준비 수량
// ---------------------------------------------------------------------------

const VERDICT: Record<StockVerdict, { label: string; bg: string; ink: string }> = {
  under: { label: "부족 신호", bg: "#FFE4DE", ink: "#BE3A2A" },
  over: { label: "과다 신호", bg: "#FFEEDD", ink: "#B4530A" },
  ok: { label: "적정 범위", bg: "#E0EFE8", ink: "#2F5F4B" },
  few: { label: "기록 부족", bg: "#F1F2F4", ink: "#8A8D93" },
  noCost: { label: "원가 미입력", bg: "#F1F2F4", ink: "#8A8D93" },
};

export function StockPanel({ stock }: { stock: DashboardAnalytics["stock"] }) {
  if (!stock.applicable) {
    return (
      <Panel title="준비 수량 진단">
        <Empty>{stock.category || "이 카테고리"} 상품은 남아도 다음 행사에 다시 팔 수 있어 이 진단(당일 소진 상품용) 대상 아님</Empty>
      </Panel>
    );
  }
  if (stock.items.length === 0) {
    return (
      <Panel title="준비 수량 진단">
        <Empty>상품별 준비·판매 수량 기록 없음</Empty>
      </Panel>
    );
  }
  return (
    <Panel title="준비 수량 진단">
      <ul className="flex flex-col gap-4">
        {stock.items.map((it) => {
          const v = VERDICT[it.verdict];
          return (
            <li key={it.productName} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{it.productName}</p>
                <p className="text-[11px] text-neutral-500">
                  품절 {it.stockouts}/{it.n}회{it.optimalRate != null && ` · 적정 ${pct(it.optimalRate)}`}
                </p>
              </div>
              <div className="relative order-3 col-span-2 h-5 sm:order-none sm:col-span-1" aria-label={`품절률 ${pct(it.rate)}, 95% 구간 ${pct(it.low)}~${pct(it.high)}`}>
                <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-200" />
                <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: pct(it.low, 1), width: pct(it.high - it.low, 1), background: SKY }} />
                <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: pct(it.rate, 1), background: SKY_DARK }} />
                {it.optimalRate != null && <div className="absolute inset-y-0 w-0 border-l-2 border-dashed" style={{ left: pct(it.optimalRate, 1), borderColor: CORAL }} />}
              </div>
              <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: v.bg, color: v.ink }}>{v.label}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: SKY_DARK }} />실제 품절률(막대 = 95% 구간)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0 border-l-2 border-dashed" style={{ borderColor: CORAL }} />적정 품절률 = 원가 ÷ 가격</span>
      </div>
      <Footnote>
        당일 못 팔면 버리는 상품은 &quot;원가 ÷ 가격&quot; 비율만큼 품절되는 것이 손익상 최적(뉴스벤더 모형). 실제 품절 빈도가 이와
        통계적으로 다를 때만(정확 이항검정, 상품 간 Holm 보정, 기록 {STOCK_RULES.minEvents}회 이상) 부족·과다 신호를 표시.
        품절로 잃는 단골·평판 비용은 반영하지 않음.
      </Footnote>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// ⑦ 계획 정확도 · ④ 동종 비교 (수익성 카드 안의 한 줄)
// ---------------------------------------------------------------------------

export function PlanLine({ plan }: { plan: DashboardAnalytics["plan"] }) {
  if (plan.status !== "ok") {
    return <p className="text-xs text-neutral-400">예상 매출 정확도: 예상·실제 매출을 함께 적은 행사 {plan.n}/{PLAN_RULES.minPairs}회</p>;
  }
  return (
    <p className="text-xs leading-5 text-neutral-600">
      예상 매출 대비 실제{" "}
      <span className="font-semibold tabular-nums text-neutral-900">{signedPct(plan.pct)}</span>{" "}
      <span className="text-neutral-400">(95% 구간 {signedPct(plan.low)}~{signedPct(plan.high)}, {plan.n}회)</span>
      {" — "}
      {plan.biased ? (plan.pct < 0 ? "예상을 높게 잡는 편" : "예상을 낮게 잡는 편") : "체계적 차이 없음"}
    </p>
  );
}

export function PeerLine({ peer }: { peer: DashboardAnalytics["peer"] }) {
  if (peer.status !== "ok") return <p className="text-xs text-neutral-400">동종 비교 보류: {peer.reason}</p>;
  return (
    <p className="text-xs text-neutral-600">
      {peer.category} 가게 {peer.peers}곳 중{" "}
      <span className="font-semibold text-neutral-900">상위 {Math.max(1, Math.round((1 - peer.below) * 100))}%</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// 분석 방법과 한계
// ---------------------------------------------------------------------------

export function MethodsNote({ analytics }: { analytics: DashboardAnalytics }) {
  const { data } = analytics;
  const synth = data.records ? data.syntheticRecords / data.records : 0;
  return (
    <details className="mt-10 rounded-2xl border border-white/80 bg-white/70 p-5 text-sm text-neutral-600 backdrop-blur-sm">
      <summary className="cursor-pointer font-semibold text-neutral-800">분석 방법과 한계</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-6">
        <li>
          분석 데이터: 참가 완료 기록 {data.records}건(가게 {data.stores}곳).{" "}
          {data.syntheticRecords > 0 && (
            <strong className="font-semibold text-neutral-800">
              이 중 {data.syntheticRecords}건({pct(synth)})은 기능 검증용 합성 데이터라, 지금 보이는 결과를 실제 시장 현상으로 해석하면 안 됨.
            </strong>
          )}
        </li>
        <li>
          매출이 달랐던 조건: ln(매출) = 가게 고정효과 + 날씨 + 실외 + 주말 + 행사 유형 + ln(행사 일수). 같은 가게 안의 비교만 반영.
          행사 단위 군집-강건 표준오차(CR3), Holm 보정. 최소 기록 {FACTOR_RULES.minRecords}건·행사 {FACTOR_RULES.minEvents}곳, 조건별 {FACTOR_RULES.minLevelCount}건 이상,
          그 조건이 있었던 행사·없었던 행사 각 {FACTOR_RULES.minEventsPerLevel}곳 이상(날씨 같은 행사 단위 조건은 행사 수가 실질 표본).
        </li>
        <li>
          예상 매출: 행사 전에 알 수 있는 정보(주말·일수·유형)만 쓰는 별도 모형 + 가게 효과의 경험적 베이즈 축소 추정.
          구간은 하나씩 빼고 예측한 오차의 실제 분포로 정함(conformal 예측 — 품절로 매출에 상한이 있어 정규분포 가정이 맞지 않음).
          내 기록 {FORECAST_RULES.minStoreRecords}건 이상일 때만, 가게 단위 10겹 교차검증에서 80% 구간 적중률이 80%와 유의하게 다르지 않을 때만 표시.
        </li>
        <li>적자 확률: 보정된 예측분포에서 매출이 손익분기 매출(고정비 ÷ (1 − 원가율))보다 낮을 확률을 직접 계산.</li>
        <li>준비 수량: 뉴스벤더 최적 조건(최적 품절률 = 원가 ÷ 가격)과 실제 품절 빈도를 정확 이항검정으로 비교. 음식·디저트 상품만.</li>
        <li>예상 매출 정확도: 같은 행사의 ln(실제 ÷ 예상) 평균의 t 신뢰구간. 목표 매출은 예측이 아니라 쓰지 않음.</li>
        <li>동종 비교: 같은 카테고리 가게 {PEER_RULES.minPeers}곳 이상(각 {PEER_RULES.minPeerRecords}건 이상)일 때만 순위 표시.</li>
        <li>
          구현 검증: 정답을 아는 가상 데이터로 반복 실험해 신뢰구간 포함률, 효과 없는 조건 오탐률, 예측구간 적중률,
          준비 수량 판정 방향을 확인(npm run test:analytics, npm run evaluate:synthetic).
        </li>
      </ul>
    </details>
  );
}
