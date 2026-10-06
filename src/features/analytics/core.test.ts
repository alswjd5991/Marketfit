// 통계 계산 자체가 맞는지 검증한다 — (1) 통계표·R 결과와 수치 비교, (2) 정답을 아는 가상 데이터를
// 수백 번 만들어 신뢰구간이 명목 수준(95%)만큼 정답을 포함하는지 확인(시뮬레이션 검증).
import { test } from "node:test";
import assert from "node:assert/strict";
import { binomTestTwoSided, holmAdjust, tCdf, tQuantile, wilsonInterval } from "./distributions";
import { fitOls } from "./ols";

const close = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

/** 시드 고정 난수 + 표준정규(Box-Muller) */
export function rng(seed: number) {
  const u = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, normal };
}

test("t분포 분위수·누적확률이 통계표 값과 일치", () => {
  close(tQuantile(0.975, 10), 2.228139, 1e-5);
  close(tQuantile(0.975, 30), 2.042272, 1e-5);
  close(tQuantile(0.9, 5), 1.475884, 1e-5);
  close(tQuantile(0.025, 4), -2.776445, 1e-5);
  close(tCdf(2.0, 20), 0.9703672, 1e-6);
});

test("정확 이항검정·Wilson 구간·Holm 보정이 R 결과와 일치", () => {
  close(binomTestTwoSided(7, 20, 0.5), 0.263176, 1e-5); // binom.test(7, 20)
  close(binomTestTwoSided(2, 10, 0.5), 0.109375, 1e-6); // binom.test(2, 10)
  // Bin(12, 0.3)에서 P(K≥9) = 0.0014853+0.0001910+0.0000149+0.0000005, 아래쪽은 모두 관측확률보다 커서 제외
  close(binomTestTwoSided(9, 12, 0.3), 0.0016917, 1e-6);
  const [lo, hi] = wilsonInterval(7, 20); // prop.test(7, 20, correct = FALSE)
  close(lo, 0.18119, 1e-4);
  close(hi, 0.56716, 1e-4);
  assert.deepEqual(holmAdjust([0.01, 0.04, 0.03]).map((p) => +p.toFixed(4)), [0.03, 0.06, 0.06]); // p.adjust(method = "holm")
});

test("단순회귀 계수·표준오차가 공식 해와 일치", () => {
  const x = [1, 2, 3, 4, 5, 6];
  const y = [2.1, 3.9, 6.2, 7.8, 10.1, 12.2];
  const fit = fitOls(x.map((v) => [1, v]), y, ["const", "x"])!;
  const mx = 3.5, my = y.reduce((a, b) => a + b) / 6;
  const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  const slope = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / sxx;
  close(fit.beta[1], slope, 1e-10);
  close(fit.beta[0], my - slope * mx, 1e-10);
  close(Math.sqrt(fit.vcov[1][1]), Math.sqrt(fit.sigma2 / sxx), 1e-10);
  assert.equal(fit.df, 4);
});

test("공선성이 있으면 적합을 거부한다", () => {
  assert.equal(fitOls([[1, 2], [2, 4], [3, 6], [4, 8]], [1, 2, 3, 4], ["a", "b"]), null);
});

test("시뮬레이션: 행사 공통 충격이 있어도 군집-강건 95% 구간이 참값을 약 95% 포함", () => {
  const { u, normal } = rng(42);
  const trueBeta = -0.4;
  const reps = 400;
  let covered = 0, coveredNaive = 0;
  for (let r = 0; r < reps; r++) {
    const X: number[][] = [], y: number[] = [], cl: string[] = [];
    for (let g = 0; g < 40; g++) {
      const shock = 0.4 * normal(); // 그 행사에 온 모든 셀러가 같이 받는 충격
      const eventRain = u() < 0.3 ? 1 : 0; // 설명변수도 행사 단위로 같이 움직이는 상황(가장 까다로운 경우)
      for (let j = 0; j < 4; j++) {
        X.push([1, eventRain]);
        y.push(1 + trueBeta * eventRain + shock + 0.3 * normal());
        cl.push(`e${g}`);
      }
    }
    const robust = fitOls(X, y, ["const", "rain"], cl)!;
    const naive = fitOls(X, y, ["const", "rain"])!;
    const inside = (fit: typeof robust) => Math.abs(fit.beta[1] - trueBeta) <= tQuantile(0.975, fit.df) * Math.sqrt(fit.vcov[1][1]);
    if (inside(robust)) covered++;
    if (inside(naive)) coveredNaive++;
  }
  const rate = covered / reps;
  assert.ok(rate > 0.91 && rate < 0.985, `군집-강건 포함률 ${rate}`);
  // 군집을 무시하면 구간이 너무 좁아져 포함률이 명목보다 떨어진다 — 군집 보정이 필요한 이유.
  assert.ok(coveredNaive / reps < rate, `일반 SE 포함률 ${coveredNaive / reps}`);
});
