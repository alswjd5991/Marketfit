// 대시보드 분석 패널(서버 컴포넌트). 숫자는 모두 compute.ts가 계산한 요약값만 받는다.
//
// 기존 대시보드 차트와 같은 틀(Panel: 제목 15px, 본문 13~14px)을 쓰고, 계산 방법·기준 같은 부가 설명은
// 제목 옆 물음표(InfoTip)에 넣어 화면은 깔끔하게 둔다. 문장은 해요체, 통계 용어는 쓰지 않는다.

import type { ReactNode } from "react";
import { STATUS_COLORS } from "@/components/ui/chart-colors";
import { Empty, Panel } from "@/features/dashboard/panel";
import { josa } from "@/lib/josa";
import type { DashboardAnalytics, ForecastItem } from "./data";
import { STOCK_RULES, type StockDiagnosis, type StockVerdict } from "./stock";
import { PLAN_RULES } from "./plan";

const SKY = "#9CCFEE";
const BAD = STATUS_COLORS.critical;

export function manwon(n: number): string {
  const v = n / 10000;
  return `${Math.abs(v) >= 10 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toString()}만원`;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const absPct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

function Tip({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block last:mb-0">{children}</span>;
}

// ---------------------------------------------------------------------------
// 행사 적합도 (내가 담은 행사 + 추천 행사)
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs text-neutral-400">-</span>;
  const tone = score >= 60 ? "bg-[#E0EFE8] text-[#2F5F4B]" : score >= 40 ? "bg-[#EAF4FB] text-[#1F5F8B]" : "bg-[#FFEEDD] text-[#B4530A]";
  return (
    <span className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-full leading-none ${tone}`} title={`적합도 ${score}점`}>
      <span className="text-[15px] font-bold tabular-nums">{score}</span>
      <span className="mt-0.5 text-[9px] font-semibold">점</span>
    </span>
  );
}

function FitRow({ it }: { it: ForecastItem }) {
  const p = it.prediction;
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <ScoreBadge score={it.score} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-neutral-900">{it.eventName}</p>
        <p className="mt-0.5 truncate text-xs text-[#8A8D93]">
          {md(it.startDate)} · {it.group}
          {it.lossProbability != null && it.lossProbability >= 0.1 && (
            <span style={{ color: it.lossProbability >= 0.3 ? BAD : "#B4530A" }}> · 손해 확률 {pct(it.lossProbability)}</span>
          )}
        </p>
      </div>
      {p.ok ? (
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums text-neutral-950">{manwon(p.median)}</p>
          <p className="text-[11px] tabular-nums text-[#8A8D93]">{manwon(p.low)}~{manwon(p.high)}</p>
        </div>
      ) : (
        <p className="shrink-0 text-xs text-neutral-400">예상 어려움</p>
      )}
    </li>
  );
}

export function EventFitPanel({ forecast }: { forecast: DashboardAnalytics["forecast"] }) {
  if (forecast.status === "hidden") {
    return (
      <Panel title="행사 적합도">
        <Empty>참가 기록이 더 쌓이면 행사별 적합도를 보여 드려요</Empty>
      </Panel>
    );
  }
  const { items, recommended, myMedian, validation, region } = forecast;
  const column = (title: string, list: ForecastItem[], empty: string) => (
    <div className="min-w-0">
      <p className="mb-3 text-[13px] font-semibold text-neutral-500">{title}</p>
      {list.length ? (
        <ul className="divide-y divide-neutral-100">{list.map((it) => <FitRow key={`${it.eventName}-${it.startDate}`} it={it} />)}</ul>
      ) : (
        <p className="py-6 text-center text-sm text-neutral-400">{empty}</p>
      )}
    </div>
  );
  return (
    <Panel
      title="행사 적합도"
      info={
        <>
          <Tip>점수는 그 행사에서 <b>내 평소 매출({manwon(myMedian)})보다 더 팔 확률</b>이에요. 오른쪽은 예상 매출과, 실제 매출이 보통 들어오는 범위예요.</Tip>
          <Tip>내 지난 매출과 다른 셀러들의 기록을 함께 보고, 행사 유형·기간·주말 여부로 계산해요. 날씨는 미리 알 수 없어 범위에 포함했어요.</Tip>
          <Tip>지난 기록 {validation.n.toLocaleString()}건으로 미리 맞혀 봤더니 실제 매출이 범위 안에 {pct(validation.coverage)} 들어왔어요.</Tip>
          <Tip>손해 확률은 참가비·평소 비용·상품 원가를 빼고 남는 돈이 0보다 적을 가능성이에요(10% 이상일 때만 표시).</Tip>
          <Tip>추천 행사는 아직 담지 않은, 앞으로 90일 안에 열리는 행사예요(활동 지역이 있으면 그 지역).</Tip>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-neutral-100 lg:[&>*:first-child]:pr-6 lg:[&>*:last-child]:pl-6">
        {column("내가 담은 행사", items, "관심·참가 예정 행사를 담으면 보여 드려요")}
        {column(region ? `추천 행사 · ${region}` : "추천 행사", recommended, "앞으로 90일 안에 열리는 행사가 없어요")}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 같은 업종 대비 매출
// ---------------------------------------------------------------------------

// 같은 업종 대비 매출 — 초록 계열 박스플롯 + 내 위치(사이트의 노을 코랄)
const BOX_FILL = "#DDF0E6";
const BOX_LINE = "#3F7A64";
const MEDIAN = "#1E4D3A";
const ME = "#F2836B";

export const peerInfo = (
  <>
    <Tip>같은 카테고리에서 행사 기록이 3번 이상인 가게들의 행사당 평균 매출을 상자 그림으로 나타냈어요. 다른 가게의 매출은 범위로만 보여 드려요.</Tip>
    <Tip>상자는 가운데 50% 가게(25~75%), 양옆으로 뻗은 선은 가운데 80% 가게(10~90%)가 있는 범위예요. 상자 안의 진한 선이 중앙값이에요.</Tip>
    <Tip>중앙값은 가게들을 매출 순으로 세웠을 때 한가운데 가게의 매출이고, 평균은 모든 가게 매출을 더해 가게 수로 나눈 값이에요. 매출이 아주 큰 가게가 있으면 평균이 중앙값보다 커져요.</Tip>
  </>
);

/** 같은 업종 대비 매출 — 대시보드 "최근 성과" 안에 들어가는 박스플롯(제목·틀은 바깥 ChartPanel). */
export function PeerChart({ peer }: { peer: DashboardAnalytics["peer"] }) {
  if (peer.status !== "ok") {
    return <p className="flex h-[160px] items-center justify-center text-sm text-[#8A8D93]">비교할 같은 업종 가게가 더 모이면 보여 드려요</p>;
  }
  const total = peer.peers + 1;
  const higher = Math.round(peer.peers * (1 - peer.below));
  const top = Math.round(((higher + 1) / total) * 100);
  const label = top <= 50 ? `상위 ${top}%` : `하위 ${Math.round(((total - higher) / total) * 100)}%`;
  const { p10, q1, median, q3, p90, mean } = peer.dist;
  const lo = Math.min(p10, peer.mine) * 0.9;
  const hi = Math.max(p90, peer.mine) * 1.06;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const x = (v: number) => `${pos(v)}%`;
  const meLabel = `${Math.min(88, Math.max(12, pos(peer.mine)))}%`; // 이름표가 가장자리에서 잘리지 않게
  return (
    <div>
      <p className="text-sm text-[#43464B]">
        {peer.category} 가게 {total}곳 중 <span className="font-bold text-[#1F2023]">{label}</span>예요
      </p>
      <div className="relative mx-6 mt-11 h-[92px]">
        {/* 내 위치 이름표 */}
        <span className="absolute top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold text-white shadow-sm" style={{ left: meLabel, background: ME }}>
          내 가게 {manwon(peer.mine)}
        </span>
        {/* 수염(10~90%)과 끝 막대 */}
        <div className="absolute top-[30px] h-0.5 -translate-y-1/2" style={{ left: x(p10), width: `calc(${x(p90)} - ${x(p10)})`, background: BOX_LINE }} />
        <div className="absolute top-[18px] h-6 w-0.5 -translate-x-1/2" style={{ left: x(p10), background: BOX_LINE }} />
        <div className="absolute top-[18px] h-6 w-0.5 -translate-x-1/2" style={{ left: x(p90), background: BOX_LINE }} />
        {/* 상자(25~75%)와 중앙값 */}
        <div className="absolute top-[10px] h-10 rounded-md border-2" style={{ left: x(q1), width: `calc(${x(q3)} - ${x(q1)})`, background: BOX_FILL, borderColor: BOX_LINE }} />
        <div className="absolute top-[10px] h-10 w-[3px] -translate-x-1/2 rounded" style={{ left: x(median), background: MEDIAN }} />
        <div className="absolute top-[30px] size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 bg-white" style={{ left: x(mean), borderColor: MEDIAN }} />
        {/* 내 위치: 점선 + 점 */}
        <div className="absolute top-0 h-[60px] w-0 -translate-x-1/2 border-l-2 border-dashed" style={{ left: x(peer.mine), borderColor: ME }} />
        <div className="absolute top-[30px] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: x(peer.mine), background: ME }} />
        {/* 눈금 값 */}
        <span className="absolute top-[66px] -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-[#8A8D93]" style={{ left: x(p10) }}>{manwon(p10)}</span>
        <span className="absolute top-[66px] -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums" style={{ left: x(median), color: MEDIAN }}>{manwon(median)}</span>
        <span className="absolute top-[66px] -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-[#8A8D93]" style={{ left: x(p90) }}>{manwon(p90)}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8A8D93]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border-2" style={{ background: BOX_FILL, borderColor: BOX_LINE }} />가운데 50%</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: BOX_LINE }} />가운데 80%</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-[3px] rounded" style={{ background: MEDIAN }} />중앙값 {manwon(median)}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rotate-45 border-2 bg-white" style={{ borderColor: MEDIAN }} />평균 {manwon(mean)}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 상품 포트폴리오
// ---------------------------------------------------------------------------

export function PortfolioPanel({ portfolio }: { portfolio: DashboardAnalytics["portfolio"] }) {
  const info = (
    <>
      <Tip>가로는 판매율(준비한 것 중 팔린 비율), 세로는 상품 매출에서 차지하는 비중이에요. 동그라미가 클수록 매출이 커요.</Tip>
      <Tip>점선은 내 상품들의 평균이에요. 오른쪽 위는 잘 팔리고 매출도 큰 상품, 오른쪽 아래는 잘 팔리지만 비중이 작은 상품이에요.</Tip>
    </>
  );
  if (portfolio.length < 2) {
    return (
      <Panel title="상품 포트폴리오" info={info}>
        <Empty>상품 2개 이상의 판매 기록이 쌓이면 보여 드려요</Empty>
      </Panel>
    );
  }
  const W = 320, H = 190, PAD = { l: 34, r: 14, t: 18, b: 24 };
  const maxShare = Math.max(...portfolio.map((p) => p.share)) * 1.15;
  const sx = (v: number) => PAD.l + v * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - (v / maxShare) * (H - PAD.t - PAD.b);
  const avgSell = portfolio.reduce((a, p) => a + p.sellThrough * p.revenue, 0) / portfolio.reduce((a, p) => a + p.revenue, 0);
  const avgShare = 1 / portfolio.length;
  const maxRev = Math.max(...portfolio.map((p) => p.revenue));
  const star = portfolio.find((p) => p.sellThrough >= avgSell && p.share >= avgShare);
  return (
    <Panel title="상품 포트폴리오" info={info}>
      {star && (
        <p className="mb-2 text-[14px] text-neutral-700">
          <span className="font-bold text-neutral-950">{josa(star.productName, "이", "가")}</span> 잘 팔리고 매출 비중도 커요
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto max-h-[220px] w-full" role="img" aria-label="상품별 판매율과 매출 비중">
        <line x1={sx(avgSell)} x2={sx(avgSell)} y1={PAD.t} y2={H - PAD.b} stroke="#CBD5DF" strokeDasharray="3 3" />
        <line x1={PAD.l} x2={W - PAD.r} y1={sy(avgShare)} y2={sy(avgShare)} stroke="#CBD5DF" strokeDasharray="3 3" />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#E6EEF5" />
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8A8D93">{Math.round(t * 100)}%</text>
        ))}
        <text x={PAD.l - 6} y={sy(maxShare / 1.15) + 3} textAnchor="end" fontSize="10" fill="#8A8D93">{Math.round((maxShare / 1.15) * 100)}%</text>
        <text x={PAD.l - 6} y={H - PAD.b} textAnchor="end" fontSize="10" fill="#8A8D93">0</text>
        {portfolio.map((p) => {
          const r = 5 + 9 * Math.sqrt(p.revenue / maxRev);
          return (
            <g key={p.productName}>
              <circle cx={sx(p.sellThrough)} cy={sy(p.share)} r={r} fill={p.sellThrough >= avgSell ? SKY : "#F7C1B4"} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
              <text x={sx(p.sellThrough)} y={sy(p.share) - r - 3} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="#43464B">{p.productName}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex justify-between pl-[10%] text-[11px] text-[#8A8D93]">
        <span>← 많이 남음</span>
        <span>판매율</span>
        <span>잘 팔림 →</span>
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 준비 수량
// ---------------------------------------------------------------------------

const VERDICT: Record<StockVerdict, { label: string; className: string }> = {
  under: { label: "더 준비", className: "bg-[#FFE4DE] text-[#BE3A2A]" },
  over: { label: "줄여도 돼요", className: "bg-[#FFEEDD] text-[#B4530A]" },
  ok: { label: "적당", className: "bg-[#E0EFE8] text-[#2F5F4B]" },
  few: { label: "기록 부족", className: "bg-neutral-100 text-neutral-500" },
  noCost: { label: "원가 필요", className: "bg-neutral-100 text-neutral-500" },
};

function stockSummary(items: StockDiagnosis[]): ReactNode {
  const under = items.find((i) => i.verdict === "under");
  const over = items.find((i) => i.verdict === "over");
  if (under) return <><b className="text-neutral-950">{josa(under.productName, "은", "는")}</b> 자주 다 팔렸어요. 조금 더 준비해 보세요</>;
  if (over) return <><b className="text-neutral-950">{josa(over.productName, "은", "는")}</b> 자주 남았어요. 조금 줄여도 괜찮아요</>;
  if (items.some((i) => i.verdict === "ok")) return "지금 준비하는 양에 큰 문제는 없어 보여요";
  return "기록이 더 쌓이면 알려 드려요";
}

export function StockPanel({ stock }: { stock: DashboardAnalytics["stock"] }) {
  const info = (
    <>
      <Tip>1개 덜 가져가서 못 판 손해(가격 − 원가)와 1개 더 가져가서 남은 손해를 비교해, 다 팔리는 날이 얼마나 있어야 가장 이득인지 계산해요.</Tip>
      <Tip>
        {stock.perishable
          ? "남은 상품은 버려야 해서 원가 전부를 손해로 봤어요. 원가가 가격의 30%라면 10번 중 3번쯤 다 팔리는 게 적당해요."
          : `남은 상품은 다시 팔 수 있지만 운반·포장·보관 부담이 있어 원가의 ${Math.round(stock.lossRate * 100)}%를 손해로 봤어요. 그래서 다 팔리는 날이 드물수록 좋아요.`}
      </Tip>
      <Tip>기록이 {STOCK_RULES.minEvents}번 이상이고 차이가 우연이라고 보기 어려울 때만 알려 드려요.</Tip>
    </>
  );
  if (stock.items.length === 0) {
    return (
      <Panel title="준비 수량" info={info} className="h-full">
        <Empty>상품별 준비·판매 수량을 기록하면 보여 드려요</Empty>
      </Panel>
    );
  }
  return (
    <Panel title="준비 수량" info={info} className="h-full">
      <p className="mb-4 text-[13px] leading-5 text-neutral-600">{stockSummary(stock.items)}</p>
      <ul className="divide-y divide-neutral-100">
        {stock.items.map((it) => {
          const v = VERDICT[it.verdict];
          return (
            <li key={it.productName} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-neutral-900">{it.productName}</p>
                <p className="text-[11px] tabular-nums text-[#8A8D93]">{it.stockouts === 0 ? `${it.n}번 모두 남음` : `${it.n}번 중 ${it.stockouts}번 다 팔림`}</p>
              </div>
              <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.className}`}>{v.label}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 수익성 카드용: 예상 매출 정확도 한 줄과 물음표 설명, "한눈에 보기" 설명
// ---------------------------------------------------------------------------

/** 예상 매출 정확도 카드의 큰 값과 한 줄 설명 */
export function planCard(plan: DashboardAnalytics["plan"]): { value: string; line: ReactNode } {
  if (plan.status !== "ok") {
    return { value: "기록 부족", line: <span className="text-[13px] text-neutral-400">예상 매출 기록 {plan.n}/{PLAN_RULES.minPairs}번</span> };
  }
  if (!plan.biased) return { value: "잘 맞아요", line: <span className="text-[13px] text-neutral-500">예상과 실제 차이가 크지 않아요 · {plan.n}회</span> };
  return {
    value: `${plan.pct < 0 ? "−" : "+"}${absPct(plan.pct)}`,
    line: <span className="text-[13px] text-neutral-500">실제 매출이 예상보다 평균 {absPct(plan.pct)} {plan.pct < 0 ? "적었어요" : "많았어요"} · {plan.n}회</span>,
  };
}

export function planInfo(plan: DashboardAnalytics["plan"]): ReactNode {
  return (
    <>
      <Tip>참가 전에 적은 예상 매출이 실제 매출과 얼마나 맞았는지예요. 목표 매출(바라는 값)과는 따로 봐요.</Tip>
      <Tip>
        {plan.status === "ok"
          ? `참가 전에 적은 예상 매출과 실제 매출을 ${plan.n}번 비교해, 차이가 우연이라고 보기 어려울 때만 "많았어요/적었어요"로 알려 드려요.`
          : `예상 매출을 ${PLAN_RULES.minPairs}번 이상 적으면, 얼마나 잘 맞혔는지도 알려 드려요(지금 ${plan.n}번).`}
      </Tip>
    </>
  );
}

export function methodsInfo(analytics: DashboardAnalytics): ReactNode {
  const { data } = analytics;
  return (
    <>
      {data.syntheticRecords > 0 && (
        <Tip>
          지금 보이는 숫자는 기능을 시험하려고 만든 <b>가상 셀러의 기록</b>(참가 기록 {data.records.toLocaleString()}건 중 {data.syntheticRecords.toLocaleString()}건)으로 계산했어요.
        </Tip>
      )}
      <Tip>다른 셀러의 기록은 평균·범위 같은 요약값으로만 쓰고, 다른 가게의 기록이 그대로 보이지는 않아요.</Tip>
      <Tip>기록이 부족하거나 우연과 구분되지 않으면 결과를 보여 드리지 않아요.</Tip>
    </>
  );
}
