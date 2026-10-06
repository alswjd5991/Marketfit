// 최소제곱 회귀(OLS)와 표준오차. 설계행렬이 작아(관측 수백 × 변수 수십) 정규방정식을
// 가우스-조르단 역행렬로 직접 푼다.

export interface OlsFit {
  names: string[];
  beta: number[];
  /** 계수 분산-공분산 행렬(아래 vcovType 기준) */
  vcov: number[][];
  vcovType: "classical" | "cluster";
  /** 고전적(등분산) 분산-공분산 — 예측구간 계산용 */
  vcovClassical: number[][];
  /** 잔차 분산 추정치 s² = RSS / (n − k) */
  sigma2: number;
  n: number;
  k: number;
  /** 추론에 쓰는 자유도: 고전적이면 n − k, 군집이면 G − 1 */
  df: number;
  dfResidual: number;
  clusters: number | null;
}

/** 대칭 양정치 행렬의 역행렬(부분 피벗 가우스-조르단). 특이(공선성)하면 null. */
export function invert(a: number[][]): number[][] | null {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  const scale = Math.max(...a.map((row, i) => Math.abs(row[i])), 1e-300);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-10 * scale) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const p = m[col][col];
    for (let j = 0; j < 2 * n; j++) m[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col || m[r][col] === 0) continue;
      const f = m[r][col];
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[col][j];
    }
  }
  return m.map((row) => row.slice(n));
}

/**
 * y = Xβ + ε 를 최소제곱으로 적합한다.
 * clusters를 주면 군집-강건 표준오차를 쓴다: 같은 행사에 참가한 여러 셀러의 오차가 서로
 * 상관될 수 있어서다(그날의 방문객 수 같은 행사 공통 요인).
 * 방식은 CR3(군집 잭나이프): 잔차를 군집별로 (I − H_gg)⁻¹만큼 키워서 쓴다. 흔한 CR1은 "비 온 행사"처럼
 * 설명변수가 소수 군집에 몰리면 구간이 너무 좁아지는데(시뮬레이션에서 95% 구간 포함률 88%),
 * CR3는 소표본에서 이 문제를 바로잡는다(Bell & McCaffrey 2002; MacKinnon, Nielsen & Webb 2023).
 * 자유도는 군집 수 − 1. 공선성으로 X'X가 특이하면 null.
 */
export function fitOls(X: number[][], y: number[], names: string[], clusters?: string[]): OlsFit | null {
  const n = X.length;
  const k = names.length;
  if (n <= k) return null;
  const xtx = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = X[i];
    for (let a = 0; a < k; a++) {
      if (xi[a] === 0) continue;
      xty[a] += xi[a] * y[i];
      for (let b = 0; b < k; b++) xtx[a][b] += xi[a] * xi[b];
    }
  }
  const inv = invert(xtx);
  if (!inv) return null;
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * xty[j], 0));
  const resid = X.map((xi, i) => y[i] - xi.reduce((s, v, j) => s + v * beta[j], 0));
  const dfResidual = n - k;
  const sigma2 = resid.reduce((s, r) => s + r * r, 0) / dfResidual;
  const vcovClassical = inv.map((row) => row.map((v) => v * sigma2));

  if (!clusters) {
    return { names, beta, vcov: vcovClassical, vcovType: "classical", vcovClassical, sigma2, n, k, df: dfResidual, dfResidual, clusters: null };
  }

  const members = new Map<string, number[]>();
  clusters.forEach((c, i) => members.set(c, [...(members.get(c) ?? []), i]));
  const G = members.size;
  if (G < 2) return null;
  // (X'X)⁻¹ x_i 를 미리 계산해 두면 H_gg[i][j] = x_iᵀ (X'X)⁻¹ x_j
  const invX = X.map((xi) => inv.map((row) => row.reduce((s, v, j) => s + v * xi[j], 0)));
  const meat = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (const idx of members.values()) {
    const m = idx.length;
    const IminusH = idx.map((i, a) => idx.map((j, b) => (a === b ? 1 : 0) - X[i].reduce((s, v, t) => s + v * invX[j][t], 0)));
    const A = invert(IminusH);
    if (!A) return null; // 이 군집을 빼면 모형이 식별되지 않음(그 행사에만 있는 조건 등)
    const adjResid = A.map((row) => row.reduce((s, v, b) => s + v * resid[idx[b]], 0));
    const score = new Array<number>(k).fill(0);
    for (let a = 0; a < m; a++) for (let t = 0; t < k; t++) score[t] += X[idx[a]][t] * adjResid[a];
    for (let a = 0; a < k; a++) if (score[a] !== 0) for (let b = 0; b < k; b++) meat[a][b] += score[a] * score[b];
  }
  const adj = (G - 1) / G;
  const half = inv.map((row) => meat[0].map((_, b) => row.reduce((s, v, j) => s + v * meat[j][b], 0)));
  const vcov = half.map((row) => inv[0].map((_, b) => adj * row.reduce((s, v, j) => s + v * inv[j][b], 0)));
  return { names, beta, vcov, vcovType: "cluster", vcovClassical, sigma2, n, k, df: G - 1, dfResidual, clusters: G };
}

/** 선형결합 cᵀβ의 분산 cᵀVc. */
export function quadForm(c: number[], v: number[][]): number {
  let s = 0;
  for (let a = 0; a < c.length; a++) {
    if (c[a] === 0) continue;
    for (let b = 0; b < c.length; b++) s += c[a] * v[a][b] * c[b];
  }
  return s;
}
