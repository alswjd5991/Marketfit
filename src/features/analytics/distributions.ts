// 분석에 필요한 확률분포 함수(t분포·이항분포)와 다중비교 보정.
// 외부 라이브러리 없이 표준 수치해법으로 구현한다 — 정확도는 distributions.test.ts에서
// 통계표 값과 비교해 검증한다.

/** ln Γ(x) — Lanczos 근사(g=7, n=9). x > 0. */
export function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x); // 반사 공식
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** 정규화 불완전 베타함수 I_x(a, b) — 연분수(Lentz) 전개. */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  // 수렴이 빠른 쪽으로 대칭 변환
  if (x > (a + 1) / (a + b + 2)) return 1 - incompleteBeta(1 - x, b, a);
  const tiny = 1e-300;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 300; i++) {
    const m = i >> 1;
    let num: number;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    c = 1 + num / c;
    if (Math.abs(c) < tiny) c = tiny;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-14) break;
  }
  return (front * (f - 1)) / a;
}

/** 자유도 df인 t분포의 누적분포함수 P(T ≤ t). */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** t분포의 p 분위수(이분법 — 단조함수라 항상 수렴). */
export function tQuantile(p: number, df: number): number {
  if (p <= 0 || p >= 1) throw new RangeError("p는 0과 1 사이여야 합니다");
  let lo = -1e4, hi = 1e4;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 양측 p값: P(|T| ≥ |t|). */
export function tTwoSidedP(t: number, df: number): number {
  return Math.min(1, 2 * (1 - tCdf(Math.abs(t), df)));
}

/** 이항분포 확률질량 P(K = k), K ~ Bin(n, p). */
export function binomPmf(k: number, n: number, p: number): number {
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** 정확 이항검정 양측 p값(R binom.test와 같은 방식: 관측값보다 확률이 작거나 같은 결과의 합). */
export function binomTestTwoSided(k: number, n: number, p0: number): number {
  const observed = binomPmf(k, n, p0);
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const pi = binomPmf(i, n, p0);
    if (pi <= observed * (1 + 1e-7)) total += pi;
  }
  return Math.min(1, total);
}

/** 비율의 Wilson 신뢰구간(소표본에서도 범위를 벗어나지 않고 포함확률이 정확한 편). */
export function wilsonInterval(k: number, n: number, z = 1.959963984540054): [number, number] {
  if (n === 0) return [0, 1];
  const phat = k / n;
  const denom = 1 + (z * z) / n;
  const center = (phat + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** Holm-Bonferroni 보정 p값(입력 순서 유지). 여러 요인을 동시에 판단할 때 "우연히 하나쯤 유의" 문제를 막는다. */
export function holmAdjust(pValues: number[]): number[] {
  const order = pValues.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const m = pValues.length;
  const adjusted = new Array<number>(m);
  let running = 0;
  order.forEach(([p, i], rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}
