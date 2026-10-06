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
        <p className="shrink-0 text-xs text-neutral-400">예측 보류</p>
      )}
    </li>
  );
}

export function EventFitPanel({ forecast }: { forecast: DashboardAnalytics["forecast"] }) {
  if (forecast.status === "hidden") {
    return (
      <Panel title="행사 적합도">
        <Empty>참가 기록 부족</Empty>
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
          <Tip>점수는 그 행사에서 평소 매출({manwon(myMedian)})보다 더 팔 확률이에요. 오른쪽은 예상 매출과 예상 범위예요.</Tip>
          <Tip>행사 유형·기간·주말 여부와 지난 매출로 계산해요. 지난 기록으로 시험해 보니 실제 매출이 범위 안에 {pct(validation.coverage)} 들어왔어요.</Tip>
          <Tip>추천 행사는 앞으로 90일 안에 열리는 행사 중 아직 담지 않은 행사예요.</Tip>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-neutral-100 lg:[&>*:first-child]:pr-6 lg:[&>*:last-child]:pl-6">
        {column("내가 담은 행사", items, "담은 행사 없음")}
        {column(region ? `추천 행사 · ${region}` : "추천 행사", recommended, "추천할 행사 없음")}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 같은 업종 대비 매출
// ---------------------------------------------------------------------------

// 같은 업종 대비 매출 — 같은 업종 가게들을 반투명 점으로 깔고(가게 이름 없이 값만) 그 위에 박스플롯을 겹친다.
// 숫자는 아래 축에만, 이름은 범례로 분리하고, 내 가게는 코랄 점으로 표시한다.
const DOT = "#5FB98B";
const BOX_LINE = "#3F9A6E";
const MEDIAN = "#24684A";
const ME = "#F2836B";

export const peerInfo = (
  <>
    <Tip>같은 카테고리에서 행사 기록이 3번 이상인 가게들의 행사당 평균 매출이에요. 점 하나가 가게 하나예요(가게 이름은 보이지 않아요).</Tip>
    <Tip>선은 가장 낮은 가게부터 가장 높은 가게까지, 상자는 가운데 50% 가게가 있는 범위예요.</Tip>
  </>
);

/** 점이 겹치지 않게 세로로 흩뿌리는 고정된 오프셋(새로고침해도 같은 자리). */
const jitter = (i: number) => (((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5;

/** 같은 업종 대비 매출 — 대시보드 "최근 성과" 안에 들어가는 차트(제목·틀은 바깥 ChartPanel). */
export function PeerChart({ peer }: { peer: DashboardAnalytics["peer"] }) {
  if (peer.status !== "ok") {
    return <p className="flex h-[160px] items-center justify-center text-sm text-[#8A8D93]">비교할 가게 부족</p>;
  }
  const total = peer.peers + 1;
  const higher = Math.round(peer.peers * (1 - peer.below));
  const top = Math.round(((higher + 1) / total) * 100);
  const label = top <= 50 ? `상위 ${top}%` : `하위 ${Math.round(((total - higher) / total) * 100)}%`;
  const { min, q1, median, q3, max } = peer.dist;
  const lo = Math.min(min, peer.mine);
  const hi = Math.max(max, peer.mine);
  const pad = (hi - lo) * 0.03;
  const W = 560, H = 120, PAD = 12, TOP = 8, MID = 46, BASE = 88;
  const sx = (v: number) => PAD + ((v - lo + pad) / (hi - lo + 2 * pad)) * (W - 2 * PAD);
  const showMedianTick = sx(median) - sx(min) > 80 && sx(max) - sx(median) > 80;
  const ticks: { v: number; anchor: "start" | "middle" | "end" }[] = [
    { v: min, anchor: "start" },
    ...(showMedianTick ? [{ v: median, anchor: "middle" as const }] : []),
    { v: max, anchor: "end" },
  ];
  return (
    <div>
      <p className="text-sm text-[#43464B]">
        {peer.category} 가게 {total}곳 중 <span className="font-bold text-[#1F2023]">{label}</span>예요
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 block h-auto w-full overflow-visible" role="img" aria-label="같은 업종 가게들의 매출 분포와 내 가게 위치">
        {/* 바닥 눈금 — 포트폴리오 차트와 같은 옅은 격자·회색 숫자 */}
        <line x1={PAD} x2={W - PAD} y1={BASE} y2={BASE} stroke="#EEF1F5" />
        {ticks.map(({ v, anchor }) => (
          <g key={anchor}>
            <line x1={sx(v)} x2={sx(v)} y1={TOP} y2={BASE} stroke="#EEF1F5" />
            <text x={sx(v)} y={BASE + 16} textAnchor={anchor} fontSize="11" fill="#9A9DB0">{manwon(v)}</text>
          </g>
        ))}
        {/* 가게들(점): 반투명 원 + 흰 테두리 */}
        {peer.values.map((v, i) => (
          <circle key={i} cx={sx(v)} cy={MID + jitter(i) * 40} r={5.5} fill={DOT} fillOpacity={0.4} stroke="white" strokeWidth={1} />
        ))}
        {/* 수염(최솟값~최댓값) */}
        <line x1={sx(min)} x2={sx(max)} y1={MID} y2={MID} stroke={BOX_LINE} strokeOpacity={0.6} strokeWidth={2} />
        <line x1={sx(min)} x2={sx(min)} y1={MID - 8} y2={MID + 8} stroke={BOX_LINE} strokeWidth={2} strokeLinecap="round" />
        <line x1={sx(max)} x2={sx(max)} y1={MID - 8} y2={MID + 8} stroke={BOX_LINE} strokeWidth={2} strokeLinecap="round" />
        {/* 상자(가운데 50%): 점이 비쳐 보이게 반투명 */}
        <rect x={sx(q1)} y={MID - 22} width={Math.max(sx(q3) - sx(q1), 2)} height={44} rx={10} fill={DOT} fillOpacity={0.18} stroke={BOX_LINE} strokeWidth={1.5} />
        <line x1={sx(median)} x2={sx(median)} y1={MID - 22} y2={MID + 22} stroke={MEDIAN} strokeWidth={3} strokeLinecap="round" />
        {/* 내 가게 */}
        <circle cx={sx(peer.mine)} cy={MID} r={14} fill={ME} fillOpacity={0.18} />
        <circle cx={sx(peer.mine)} cy={MID} r={8} fill={ME} fillOpacity={0.85} stroke="white" strokeWidth={2} />
      </svg>
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B6E74]">
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: DOT, opacity: 0.6 }} />같은 업종 가게</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-full" style={{ background: MEDIAN }} />중앙값 {manwon(median)}</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: ME }} />내 가게 {manwon(peer.mine)}</li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 상품 포트폴리오
// ---------------------------------------------------------------------------

/**
 * 이름표는 차트 오른쪽에 한 줄로 세운다. 원 높이 순서를 지키고, 간격이 좁으면 아래로 밀었다가
 * 아래 끝을 넘으면 다시 위로 당긴다.
 */
function stackLabels<T extends { cy: number }>(points: T[], top: number, bottom: number) {
  const GAP = 20;
  const placed = [...points].sort((a, b) => a.cy - b.cy).map((pt) => ({ ...pt, ly: pt.cy }));
  placed.forEach((pt, i) => { pt.ly = Math.max(pt.cy, top, i ? placed[i - 1].ly + GAP : top); });
  for (let i = placed.length - 1; i >= 0; i--) placed[i].ly = Math.min(placed[i].ly, i === placed.length - 1 ? bottom : placed[i + 1].ly - GAP);
  return placed;
}

/** 판매율·매출 비중이 내 상품 평균보다 높은지로 나눈 3단계 색 */
const TIER = {
  good: { color: "#2E9C83", label: "잘 팔리고 매출도 커요" },
  mid: { color: "#E0A82E", label: "둘 중 하나만 높아요" },
  low: { color: "#F2836B", label: "둘 다 평균보다 낮아요" },
} as const;

/**
 * 상품 포트폴리오 — 원 하나가 상품 하나(크기 = 매출). 위치는 판매율(가로)과 매출 비중(세로),
 * 색은 두 값이 내 상품 평균보다 높은지에 따라 3단계(반투명).
 */
export function PortfolioPanel({ portfolio }: { portfolio: DashboardAnalytics["portfolio"] }) {
  const info = (
    <>
      <Tip>가로는 판매율(준비한 수량 중 팔린 비율), 세로는 상품 매출에서 차지하는 비중이에요. 점선은 내 상품들의 평균이에요.</Tip>
      <Tip>원이 클수록 매출이 커요.</Tip>
    </>
  );
  if (portfolio.length < 2) {
    return (
      <Panel title="상품 포트폴리오" info={info}>
        <Empty>상품 판매 기록 부족</Empty>
      </Panel>
    );
  }
  const W = 600, H = 284, PAD = { l: 44, r: 150, t: 30, b: 48 };
  const plotRight = W - PAD.r;
  const labelX = plotRight + 34;
  const shareTop = Math.min(1, Math.ceil(Math.max(...portfolio.map((p) => p.share)) * 1.3 * 10) / 10);
  const sx = (v: number) => PAD.l + v * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - (v / shareTop) * (H - PAD.t - PAD.b);
  const avgSell = portfolio.reduce((a, p) => a + p.sellThrough * p.revenue, 0) / portfolio.reduce((a, p) => a + p.revenue, 0);
  const avgShare = 1 / portfolio.length;
  const maxRevenue = Math.max(...portfolio.map((p) => p.revenue));
  const rOf = (v: number) => 10 + 30 * Math.sqrt(v / maxRevenue);
  const tier = (p: (typeof portfolio)[number]) => {
    const highs = Number(p.sellThrough >= avgSell) + Number(p.share >= avgShare);
    return highs === 2 ? TIER.good : highs === 1 ? TIER.mid : TIER.low;
  };
  const star = portfolio.find((p) => tier(p) === TIER.good);
  const points = stackLabels(portfolio.map((p) => ({ p, cx: sx(p.sellThrough), cy: sy(p.share), r: rOf(p.revenue) })), PAD.t, H - PAD.b);
  return (
    <Panel title="상품 포트폴리오" info={info}>
      {star && (
        <p className="-mt-2 mb-2 text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">{josa(star.productName, "이", "가")}</span> 잘 팔리고 매출 비중도 커요
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label="상품별 판매율과 매출 비중">
        {[0, shareTop / 2, shareTop].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={plotRight} y1={sy(t)} y2={sy(t)} stroke="#EEF1F5" />
            <text x={PAD.l - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#9A9DB0">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={sx(t)} y={H - PAD.b + 18} textAnchor="middle" fontSize="11" fill="#9A9DB0">{Math.round(t * 100)}%</text>
        ))}
        <text x={0} y={14} fontSize="11" fill="#9A9DB0">매출 비중</text>
        <text x={(PAD.l + plotRight) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#9A9DB0">판매율</text>
        <line x1={sx(avgSell)} x2={sx(avgSell)} y1={PAD.t} y2={H - PAD.b} stroke="#D5D9E3" strokeDasharray="4 4" />
        <line x1={PAD.l} x2={plotRight} y1={sy(avgShare)} y2={sy(avgShare)} stroke="#D5D9E3" strokeDasharray="4 4" />
        {[...points].sort((a, b) => b.r - a.r).map(({ p, cx, cy, r }) => {
          const c = tier(p).color;
          return (
            <g key={`c-${p.productName}`}>
              <title>{`${p.productName} · 판매율 ${Math.round(p.sellThrough * 100)}% · 매출 비중 ${Math.round(p.share * 100)}%`}</title>
              <circle cx={cx} cy={cy} r={r} fill={c} fillOpacity={0.55} stroke="white" strokeWidth={1.5} />
            </g>
          );
        })}
        {points.map(({ p, cx, cy, r, ly }) => {
          // 원 테두리에서 이름표 쪽으로 나가는 지시선
          const elbowX = plotRight + 14;
          const a = Math.atan2(ly - cy, elbowX - cx);
          return (
            <g key={`t-${p.productName}`}>
              <polyline
                points={`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)} ${elbowX},${ly} ${labelX - 6},${ly}`}
                fill="none" stroke="#B8BDC8" strokeWidth={1}
              />
              <circle cx={labelX - 6} cy={ly} r={2.5} fill={tier(p).color} />
              <text x={labelX} y={ly + 4} fontSize="12" fontWeight={600} fill="#1F2023">
                {p.productName} <tspan fontWeight={400} fill="#8A8D93">{Math.round(p.share * 100)}%</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6B6E74]">
        {Object.values(TIER).map((t) => (
          <li key={t.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: t.color, opacity: 0.55 }} />{t.label}</li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 준비 수량
// ---------------------------------------------------------------------------

const VERDICT: Record<StockVerdict, { label: string; className: string }> = {
  under: { label: "늘려 보세요", className: "bg-[#FFE4DE] text-[#BE3A2A]" },
  over: { label: "줄여 보세요", className: "bg-[#FFEEDD] text-[#B4530A]" },
  ok: { label: "적당해요", className: "bg-[#E0EFE8] text-[#2F5F4B]" },
  few: { label: "기록 부족", className: "bg-neutral-100 text-neutral-500" },
  noCost: { label: "원가 미입력", className: "bg-neutral-100 text-neutral-500" },
};

function stockSummary(items: StockDiagnosis[]): ReactNode {
  const under = items.find((i) => i.verdict === "under");
  const over = items.find((i) => i.verdict === "over");
  if (under) return <><b className="text-neutral-950">{josa(under.productName, "은", "는")}</b> 자주 다 팔렸어요. 조금 더 준비해 보세요</>;
  if (over) return <><b className="text-neutral-950">{josa(over.productName, "은", "는")}</b> 자주 남았어요. 조금 줄여도 괜찮아요</>;
  if (items.some((i) => i.verdict === "ok")) return "준비량이 적당해요";
  return "기록 부족";
}

export function StockPanel({ stock }: { stock: DashboardAnalytics["stock"] }) {
  const info = (
    <>
      <Tip>덜 가져가서 못 판 손해와 더 가져가서 남은 손해를 비교해, 다 팔리는 날이 얼마나 있어야 가장 이득인지 계산해요.</Tip>
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
        <Empty>준비·판매 수량 기록 없음</Empty>
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
  const count = <span className="text-neutral-400">({plan.n}회)</span>;
  if (!plan.biased) return <p className="text-[13px] text-neutral-500">참가 전 예상 매출이 대체로 잘 맞았어요 {count}</p>;
  return (
    <p className="text-[13px] text-neutral-500">
      참가 전 예상 매출보다 실제 매출이 평균 <span className="font-semibold text-neutral-800">{absPct(plan.pct)} {plan.pct < 0 ? "적었어요" : "많았어요"}</span> {count}
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
