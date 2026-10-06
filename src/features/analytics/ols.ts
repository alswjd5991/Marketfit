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
 * clusters를 주면 군집-강건(CR1) 표준오차를 쓴다: 같은 행사에 참가한 여러 셀러의 오차가 서로
 * 상관될 수 있어서다(그날의 방문객 수 같은 행사 공통 요인). 자유도는 군집 수 − 1, 소표본 보정 G/(G−1)·(n−1)/(n−k).
 * 공선성으로 X'X가 특이하면 null.
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

  // 군집별 점수 합 s_g = Σ_{i∈g} x_i·e_i, meat = Σ_g s_g s_gᵀ
  const scores = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const s = scores.get(clusters[i]) ?? new Array<number>(k).fill(0);
    for (let a = 0; a < k; a++) s[a] += X[i][a] * resid[i];
    scores.set(clusters[i], s);
  }
  const G = scores.size;
  if (G < 2) return null;
  const meat = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (const s of scores.values()) for (let a = 0; a < k; a++) if (s[a] !== 0) for (let b = 0; b < k; b++) meat[a][b] += s[a] * s[b];
  const adj = (G / (G - 1)) * ((n - 1) / (n - k));
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
