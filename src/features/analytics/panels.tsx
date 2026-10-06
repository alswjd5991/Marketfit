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

// 같은 업종 대비 매출 — 초록 계열 박스플롯. 내 위치는 벤치마크 도구들처럼 색 있는 세로선 하나로만 표시한다.
const GREEN_LIGHT = "#CDEBDB";
const GREEN = "#5FB98B";
const GREEN_DARK = "#2F7A57";
const ME = "#F2836B";

export const peerInfo = (
  <>
    <Tip>같은 카테고리에서 행사 기록이 3번 이상인 가게들의 행사당 평균 매출이에요.</Tip>
    <Tip>양 끝 선은 가장 낮은 가게부터 가장 높은 가게까지, 상자는 가운데 50% 가게가 있는 범위, 상자 안의 선은 한가운데 가게의 매출(중앙값)이에요.</Tip>
    <Tip>주황 선이 내 가게의 행사당 평균 매출이에요.</Tip>
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
  const { min, q1, median, q3, max } = peer.dist;
  const lo = Math.min(min, peer.mine);
  const hi = Math.max(max, peer.mine);
  const pad = (hi - lo) * 0.04;
  const pos = (v: number) => ((v - lo + pad) / (hi - lo + 2 * pad)) * 100;
  const x = (v: number) => `${pos(v)}%`;
  return (
    <div>
      <p className="text-sm text-[#43464B]">
        {peer.category} 가게 {total}곳 중 <span className="font-bold text-[#1F2023]">{label}</span>예요
      </p>
      <div className="relative mt-9 h-[78px]">
        {/* 나: 색 있는 세로선 하나 + 위에 작은 글자 */}
        <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[12px] leading-none" style={{ left: `${Math.min(94, Math.max(6, pos(peer.mine)))}%`, color: ME }}>
          <span className="font-bold">나</span> <span className="font-semibold tabular-nums">{manwon(peer.mine)}</span>
        </div>
        {/* 수염: 최솟값 ~ 최댓값 */}
        <div className="absolute top-[38px] h-[3px] -translate-y-1/2 rounded-full" style={{ left: x(min), width: `calc(${x(max)} - ${x(min)})`, background: GREEN_LIGHT }} />
        <div className="absolute top-[30px] h-4 w-[3px] -translate-x-1/2 rounded-full" style={{ left: x(min), background: GREEN }} />
        <div className="absolute top-[30px] h-4 w-[3px] -translate-x-1/2 rounded-full" style={{ left: x(max), background: GREEN }} />
        {/* 상자: 1사분위 ~ 3사분위, 중앙값 */}
        <div
          className="absolute top-[22px] h-8 rounded-xl shadow-[0_4px_14px_rgba(63,122,100,0.18)]"
          style={{ left: x(q1), width: `calc(${x(q3)} - ${x(q1)})`, background: `linear-gradient(180deg, ${GREEN_LIGHT}, ${GREEN})` }}
        />
        <div className="absolute top-[22px] h-8 w-[2px] -translate-x-1/2 bg-white" style={{ left: x(median) }} />
        {/* 내 위치 */}
        <div className="absolute top-[16px] h-[44px] w-[2px] -translate-x-1/2 rounded-full" style={{ left: x(peer.mine), background: ME }} />
        {/* 값 */}
        <span className="absolute top-[64px] -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-[#8A8D93]" style={{ left: x(min) }}>{manwon(min)}</span>
        <span className="absolute top-[64px] -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums" style={{ left: x(median), color: GREEN_DARK }}>중앙값 {manwon(median)}</span>
        <span className="absolute top-[64px] -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-[#8A8D93]" style={{ left: x(max) }}>{manwon(max)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 상품 포트폴리오
// ---------------------------------------------------------------------------

/** 버블 색: [가운데 밝은 색, 기본색, 가장자리 진한 색] — 보라·코랄·노랑 계열의 광택 버블 */
const BUBBLE_COLORS: [string, string, string][] = [
  ["#A79BFF", "#6C5CE7", "#4B3BC4"],
  ["#FFA3B1", "#FF6B81", "#E0485F"],
  ["#FFE08A", "#F9C74F", "#E0A82E"],
  ["#C3B8FF", "#8E7CF8", "#6A57E0"],
  ["#9CC7FF", "#4D96FF", "#2F74D8"],
  ["#FFC29E", "#FF9F68", "#E57E45"],
];

export function PortfolioPanel({ portfolio }: { portfolio: DashboardAnalytics["portfolio"] }) {
  const info = (
    <>
      <Tip>가로는 판매율(준비한 것 중 팔린 비율), 세로는 상품 매출에서 차지하는 비중이에요. 버블이 클수록 매출이 커요.</Tip>
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
  const items = portfolio.slice(0, BUBBLE_COLORS.length);
  const W = 560, H = 270, PAD = { l: 40, r: 20, t: 24, b: 30 };
  const shareTop = Math.min(1, Math.ceil((Math.max(...items.map((p) => p.share)) * 1.25) * 10) / 10);
  const sx = (v: number) => PAD.l + v * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - (v / shareTop) * (H - PAD.t - PAD.b);
  const avgSell = items.reduce((a, p) => a + p.sellThrough * p.revenue, 0) / items.reduce((a, p) => a + p.revenue, 0);
  const avgShare = 1 / portfolio.length;
  const maxRev = Math.max(...items.map((p) => p.revenue));
  const radius = (rev: number) => 14 + 36 * Math.sqrt(rev / maxRev);
  const star = items.find((p) => p.sellThrough >= avgSell && p.share >= avgShare);
  const yTicks = [0, shareTop / 2, shareTop];
  return (
    <Panel title="상품 포트폴리오" info={info}>
      <div className="-mt-2 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {star ? (
          <p className="text-[14px] text-neutral-700">
            <span className="font-bold text-neutral-950">{josa(star.productName, "이", "가")}</span> 잘 팔리고 매출 비중도 커요
          </p>
        ) : <span />}
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {items.map((p, k) => (
            <li key={p.productName} className="flex items-center gap-1.5 text-xs text-[#6B6E74]">
              <span className="size-2 rounded-full" style={{ background: BUBBLE_COLORS[k][1] }} />
              {p.productName}
            </li>
          ))}
        </ul>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="상품별 판매율과 매출 비중">
        <defs>
          {BUBBLE_COLORS.map(([light, base, dark], k) => (
            <radialGradient key={k} id={`bubble-${k}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={light} />
              <stop offset="55%" stopColor={base} />
              <stop offset="100%" stopColor={dark} />
            </radialGradient>
          ))}
          <filter id="bubble-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        {/* 옅은 세로 격자 + 가로 기준 */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} stroke="#EEF0F6" />
            <text x={sx(t)} y={H - 10} textAnchor="middle" fontSize="11" fill="#9A9DB0">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {yTicks.map((t) => (
          <text key={t} x={PAD.l - 10} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#9A9DB0">{Math.round(t * 100)}%</text>
        ))}
        <line x1={sx(avgSell)} x2={sx(avgSell)} y1={PAD.t} y2={H - PAD.b} stroke="#C9CCDD" strokeDasharray="4 4" />
        <line x1={PAD.l} x2={W - PAD.r} y1={sy(avgShare)} y2={sy(avgShare)} stroke="#C9CCDD" strokeDasharray="4 4" />
        {/* 버블: 같은 색의 번진 그림자 위에 광택 그라데이션 */}
        {items.map((p, k) => {
          const r = radius(p.revenue);
          const cx = sx(p.sellThrough), cy = sy(p.share);
          return <circle key={`glow-${p.productName}`} cx={cx} cy={cy + r * 0.35} r={r * 0.9} fill={BUBBLE_COLORS[k][1]} opacity={0.28} filter="url(#bubble-glow)" />;
        })}
        {items.map((p, k) => {
          const r = radius(p.revenue);
          const cx = sx(p.sellThrough), cy = sy(p.share);
          const inside = r >= 28;
          return (
            <g key={p.productName}>
              <circle cx={cx} cy={cy} r={r} fill={`url(#bubble-${k})`} opacity={0.92} />
              {inside ? (
                <>
                  <text x={cx} y={cy - 1} textAnchor="middle" fontSize="13" fontWeight={700} fill="white">{Math.round(p.share * 100)}%</text>
                  <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10.5" fill="white" opacity={0.92}>{p.productName}</text>
                </>
              ) : (
                <text x={cx} y={cy - r - 5} textAnchor="middle" fontSize="11" fontWeight={600} fill="#43464B">{p.productName}</text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex justify-between pl-[7%] text-[11px] text-[#9A9DB0]">
        <span>← 많이 남음</span>
        <span>판매율 · 세로는 매출 비중</span>
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

export function PlanLine({ plan }: { plan: DashboardAnalytics["plan"] }) {
  if (plan.status !== "ok") return null;
  if (!plan.biased) return <p className="text-[13px] text-neutral-500">참가 전 예상 매출이 대체로 잘 맞았어요</p>;
  return (
    <p className="text-[13px] text-neutral-500">
      실제 매출이 예상보다 평균 <span className="font-semibold text-neutral-800">{absPct(plan.pct)} {plan.pct < 0 ? "적었어요" : "많았어요"}</span>
    </p>
  );
}

export function planInfo(plan: DashboardAnalytics["plan"]): ReactNode {
  return (
    <>
      <Tip>행사 전에 적은 목표 매출 대비 실제 매출이에요.</Tip>
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
