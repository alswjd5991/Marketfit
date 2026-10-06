// ④ 동종 셀러 대비 위치 — 같은 카테고리 가게들의 "행사당 평균 매출" 가운데 내 순위(서술 통계).
// 비교 대상이 적으면 순위가 의미 없고 개별 가게가 드러날 수 있어, 기준을 못 넘으면 보이지 않는다.

export const PEER_RULES = { minOwnRecords: 3, minPeerRecords: 3, minPeers: 10 };

export interface StoreRevenueSummary {
  storeId: string;
  category: string;
  revenues: number[];
}

export type PeerRank =
  | {
      status: "ok"; peers: number; category: string;
      /** 내 평균보다 낮은 가게 비율 */ below: number;
      /** 내 행사당 평균 매출 */ mine: number;
      /** 비교 가게들의 행사당 평균 매출 분포 — 개별 가게가 드러나지 않게 10·25·50·75·90 백분위만 */
      dist: { p10: number; q1: number; median: number; q3: number; p90: number };
    }
  | { status: "insufficient"; reason: string };

export function peerRank(stores: StoreRevenueSummary[], storeId: string): PeerRank {
  const R = PEER_RULES;
  const mine = stores.find((s) => s.storeId === storeId);
  if (!mine || mine.revenues.length < R.minOwnRecords) return { status: "insufficient", reason: `내 매출 기록 ${mine?.revenues.length ?? 0}건(최소 ${R.minOwnRecords}건 필요)` };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const peers = stores.filter((s) => s.storeId !== storeId && s.category === mine.category && s.revenues.length >= R.minPeerRecords);
  if (peers.length < R.minPeers) return { status: "insufficient", reason: `비교할 ${mine.category} 가게 ${peers.length}곳(최소 ${R.minPeers}곳 필요)` };
  const my = mean(mine.revenues);
  const means = peers.map((p) => mean(p.revenues)).sort((a, b) => a - b);
  const q = (p: number) => {
    const h = (means.length - 1) * p;
    return means[Math.floor(h)] + (h - Math.floor(h)) * ((means[Math.ceil(h)] ?? means[Math.floor(h)]) - means[Math.floor(h)]);
  };
  return {
    status: "ok", peers: peers.length, category: mine.category, below: means.filter((m) => m < my).length / peers.length, mine: my,
    dist: { p10: q(0.1), q1: q(0.25), median: q(0.5), q3: q(0.75), p90: q(0.9) },
  };
}
