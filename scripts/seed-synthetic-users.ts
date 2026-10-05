// 실행: npm run seed:synthetic -- --dry-run   (DB를 건드리지 않고 30명 구성 + 통계 검증표만 출력)
//       npm run seed:synthetic                (기존 합성 유저를 지우고 30명을 다시 만든다)
//
// 통계 수치·가정은 scripts/synthetic-users.config.ts 참고. 시드가 고정이라 다시 실행해도 같은 30명이 나온다.
// 성별·연령·업종은 무작위 추출이 아니라 최대잉여법 쿼터로 배정한다 — 30명처럼 적으면
// 무작위 추출은 통계 비율에서 크게 벗어날 수 있어서다.
//
// DB 실행에는 .env.local의 SUPABASE_SERVICE_ROLE_KEY(seed-events.ts와 같음)와
// SYNTHETIC_USER_PASSWORD(합성 유저 30명 공통 로그인 비밀번호, 직접 정해서 추가)가 필요하다.
// 합성 유저는 이메일 도메인 @synthetic.marketfit.test로 구분된다.

import { config } from "dotenv";
config({ path: ".env.local" });

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database, ParticipationStatus } from "../src/types/database";
import { seedEvents } from "../src/lib/data/seed-events";
import * as C from "./synthetic-users.config";

// ---------------------------------------------------------------------------
// 시드 고정 난수
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(C.SEED);
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const won = (lo: number, hi: number) => Math.round(int(lo, hi) / 1000) * 1000;
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function weighted(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const [k, w] of Object.entries(weights)) if ((r -= w) < 0) return k;
  return Object.keys(weights).at(-1)!;
}

/** 최대잉여법: 비중을 n명 정수 쿼터로 나눈다(합계가 정확히 n). */
function quotas(weights: Record<string, number>, n: number): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const exact = Object.entries(weights).map(([k, w]) => [k, (w / total) * n] as const);
  const result = Object.fromEntries(exact.map(([k, v]) => [k, Math.floor(v)]));
  let left = n - Object.values(result).reduce((a, b) => a + b, 0);
  for (const [k] of [...exact].sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
    if (left-- <= 0) break;
    result[k]++;
  }
  return result;
}
const expand = (q: Record<string, number>) => shuffle(Object.entries(q).flatMap(([k, c]) => Array<string>(c).fill(k)));

// ---------------------------------------------------------------------------
// 1단계: 30명 인구통계 구성(DB 없이 결정됨)
// ---------------------------------------------------------------------------
type Edge = (typeof C.EDGE_CASES)[number];
interface Persona {
  no: number;
  email: string;
  name: string;
  given: string;
  gender: "여성" | "남성";
  age: string;
  industry: keyof typeof C.INDUSTRY.categories;
  category: string;
  region: string;
  edge: Edge | null;
}

function buildPersonas(): Persona[] {
  const n = C.USER_COUNT;
  const genders = expand(quotas(C.GENDER.weights, n)) as Persona["gender"][];
  const ages = expand(quotas(C.AGE.weights, n));
  const industryQuota = quotas(C.INDUSTRY.weights, n);
  // 업종 안의 카테고리는 [가정] 균등 배분.
  const cats = shuffle(
    Object.entries(industryQuota).flatMap(([industry, count]) => {
      const list = C.INDUSTRY.categories[industry as Persona["industry"]];
      const q = quotas(Object.fromEntries(list.map((c) => [c, 1])), count);
      return Object.entries(q).flatMap(([c, k]) => Array(k).fill({ industry, category: c }));
    })
  ) as { industry: Persona["industry"]; category: string }[];
  const regionWeights: Record<string, number> = {};
  for (const e of seedEvents) if (e.region) regionWeights[e.region] = (regionWeights[e.region] ?? 0) + 1;
  const regions = expand(quotas(regionWeights, n));

  const usedNames = new Set<string>();
  return Array.from({ length: n }, (_, i) => {
    const gender = genders[i];
    const pool = C.GIVEN_NAMES[gender][ages[i] === "50대" || ages[i] === "60대 이상" ? "older" : "younger"];
    let given: string, name: string;
    do {
      given = pick(pool);
      name = pick(C.SURNAMES) + given;
    } while (usedNames.has(name));
    usedNames.add(name);
    return {
      no: i + 1,
      email: `seller${String(i + 1).padStart(2, "0")}@${C.EMAIL_DOMAIN}`,
      name,
      given,
      gender,
      age: ages[i],
      ...cats[i],
      region: regions[i],
      edge: C.EDGE_CASES[i] ?? null, // 앞 8명은 경계 사례(인구통계는 이미 쿼터로 정해져 있음)
    };
  });
}

/** 생성 결과의 비율을 원 통계와 나란히 보여준다(발표·보고서용 근거 표). */
function printValidation(personas: Persona[]) {
  const table = (title: string, source: string, weights: Record<string, number>, key: (p: Persona) => string) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    console.log(`\n■ ${title}  (출처: ${source})`);
    console.log("항목".padEnd(12) + "통계 비중".padStart(10) + "목표 인원".padStart(10) + "생성 인원".padStart(10));
    const q = quotas(weights, personas.length);
    for (const [k, w] of Object.entries(weights)) {
      const got = personas.filter((p) => key(p) === k).length;
      assert.equal(got, q[k], `${title} ${k}: 쿼터와 생성 인원이 다름`);
      console.log(k.padEnd(12) + `${((w / total) * 100).toFixed(1)}%`.padStart(10) + `${q[k]}`.padStart(10) + `${got}`.padStart(10));
    }
  };
  table("대표자 성별", C.SOURCES[C.GENDER.source].title, C.GENDER.weights, (p) => p.gender);
  table("대표자 연령", C.SOURCES[C.AGE.source].title, C.AGE.weights, (p) => p.age);
  table("업종(행사 판매 관련 3개 업종 재정규화)", C.SOURCES[C.INDUSTRY.source].title, C.INDUSTRY.weights, (p) => p.industry);

  console.log("\n■ 30명 목록");
  for (const p of personas) {
    console.log(`${String(p.no).padStart(2)} ${p.name} ${p.gender} ${p.age.padEnd(6)} ${p.category.padEnd(5)} ${p.region.padEnd(3)} ${p.edge ?? (C.REGULARS.includes(p.no) ? "단골" : "")}`);
  }
}

// ---------------------------------------------------------------------------
// 2단계: DB 적재
// ---------------------------------------------------------------------------
type Db = ReturnType<typeof createClient<Database>>;
interface EventRow {
  id: string;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  event_recruitments: { fee: number | null }[];
}

async function deleteExistingSynthetic(db: Db) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const mine = data.users.filter((u) => u.email?.endsWith(`@${C.EMAIL_DOMAIN}`));
    // profiles → stores → 참가·판매·체크리스트는 on delete cascade로 같이 지워진다.
    for (const u of mine) {
      const { error: delError } = await db.auth.admin.deleteUser(u.id);
      if (delError) throw delError;
    }
    if (mine.length) console.log(`기존 합성 유저 ${mine.length}명 삭제`);
    if (data.users.length < 1000) break;
  }
}

async function seedPersona(db: Db, p: Persona, events: EventRow[], password: string, today: string) {
  const { data: created, error } = await db.auth.admin.createUser({
    email: p.email,
    password,
    email_confirm: true,
    user_metadata: { synthetic: true },
  });
  if (error || !created.user) throw error ?? new Error("유저 생성 실패");
  const userId = created.user.id;
  await db.from("profiles").update({ name: p.name }).eq("id", userId);
  if (p.edge === "no_store") return;

  const regular = C.REGULARS.includes(p.no);
  const catalog = C.PRODUCTS[p.category];
  const isFood = ["음식", "디저트", "농산물"].includes(p.category);
  const products = shuffle([...catalog.names]).slice(0, regular ? catalog.names.length : int(3, 5)).map((name) => {
    const price = won(...catalog.price);
    return { name, price, cost: Math.round((price * int(30, 50)) / 100 / 100) * 100 };
  });
  const paymentMethods = rand() < 0.5 ? ["카드", "현금", "계좌이체"] : ["카드", "현금"];

  const { data: store, error: storeError } = await db
    .from("stores")
    .insert({
      owner_id: userId,
      name: `${p.given}네 ${p.category}`,
      category: p.category,
      flagship_product: products[0].name,
      active_region: p.edge === "no_region" ? null : p.region,
      payment_methods: paymentMethods,
      hygiene_certified: isFood ? true : null,
    })
    .select("id")
    .single();
  if (storeError || !store) throw storeError;

  const { data: productRows, error: productError } = await db
    .from("products")
    .insert(products.map((x) => ({ store_id: store.id, name: x.name, category: p.category, price: x.price, cost: x.cost })))
    .select("id, name, price");
  if (productError || !productRows) throw productError;

  // 참가할 행사 고르기: [가정] 70%는 내 활동 지역 행사.
  const past = (e: EventRow) => (e.end_date ?? e.start_date)! < today;
  const pool = shuffle(events.filter((e) => e.start_date));
  const pickEvents = (list: EventRow[], n: number) => {
    const local = list.filter((e) => e.region === p.region);
    const other = list.filter((e) => e.region !== p.region);
    const out: EventRow[] = [];
    while (out.length < n && (local.length || other.length)) out.push(((rand() < 0.7 && local.length) || !other.length ? local : other).shift()!);
    return out;
  };
  const chosen = regular
    ? [
        ...pickEvents(pool.filter((e) => past(e) && e.start_date! >= C.REGULAR.since), int(...C.REGULAR.past)),
        ...pickEvents(pool.filter((e) => !past(e)), int(...C.REGULAR.future)),
      ]
    : pickEvents(
        p.edge === "single_attended" ? pool.filter(past) : pool,
        { no_participation: 0, single_attended: 1, heavy: int(15, 18) }[p.edge as string] ?? int(2, 8)
      );
  if (p.edge === "empty_checklist" && !chosen.some((e) => !past(e))) {
    const future = pool.find((e) => !past(e) && !chosen.includes(e));
    if (future) chosen.push(future);
  }
  chosen.sort((a, b) => a.start_date!.localeCompare(b.start_date!)); // 오래된 행사부터(단골의 판매율 성장 곡선용)
  const pastCount = chosen.filter(past).length;
  const revenues: number[] = [];

  for (const [i, e] of chosen.entries()) {
    const status: ParticipationStatus = past(e)
      ? rand() < (regular ? 0.95 : 0.9) ? "attended" : "interested" // 관심만 두고 안 간 행사
      : (weighted({ planning_to_attend: 60, interested: 40 }) as ParticipationStatus); // 화면은 관심/참가 예정/참가 완료 3단계
    const fee = (e.event_recruitments[0]?.fee ?? won(...C.EVENT_RESULT.feeWhenUnknown)) * (p.edge === "always_loss" ? 3 : 1);
    // 기록 시점: 행사 10~40일 전(오늘 이후면 지금). AI가 created_at 최신순으로 기록을 읽기 때문.
    const recordedAt = new Date(e.start_date!);
    recordedAt.setDate(recordedAt.getDate() - int(10, 40));
    const row: Database["public"]["Tables"]["event_participations"]["Insert"] = {
      store_id: store.id,
      event_id: e.id,
      status,
      fee,
      created_at: (recordedAt.toISOString().slice(0, 10) < today ? recordedAt : new Date()).toISOString(),
    };
    const booth = () => ({
      booth_provided: pick(["organizer", "self"]),
      booth_size: pick(C.REGULAR.boothSize),
      power_available: rand() < 0.6,
      vehicle_access: rand() < 0.5,
    });

    const sales: { product_id: string; product_name: string; prepared: number; sold: number; price: number }[] = [];
    if (status === "attended" && p.edge !== "unrecorded_result") {
      const weather = weighted(C.EVENT_RESULT.weather);
      const [g0, g1] = C.REGULAR.learning;
      const growth = regular ? g0 + ((g1 - g0) * i) / Math.max(1, pastCount - 1) : 1;
      for (const prod of shuffle([...productRows]).slice(0, int(2, productRows.length))) {
        const prepared = int(...(regular ? C.REGULAR.prepared : C.EVENT_RESULT.prepared));
        const [lo, hi] = C.EVENT_RESULT.sellThrough;
        const rate = (p.edge === "always_loss" ? lo * 0.5 : lo + rand() * (hi - lo)) * C.EVENT_RESULT.weatherFactor[weather] * growth;
        sales.push({ product_id: prod.id, product_name: prod.name, prepared, sold: Math.floor(prepared * Math.min(1, rate)), price: Number(prod.price) });
      }
      const total = sales.reduce((a, s) => a + s.sold * s.price, 0);
      revenues.push(total);
      const transport = won(...C.EVENT_RESULT.transport);
      const parking = won(...C.EVENT_RESULT.parking);
      const lodging = regular && e.region !== p.region && rand() < 0.5 ? won(...C.REGULAR.lodging) : 0;
      const other = regular ? won(...C.REGULAR.other) : 0;
      const net = total - fee - transport - parking - lodging - other;
      const margin = total > 0 ? net / total : -1;
      const satisfaction = margin < 0 ? int(1, 2) : margin < 0.3 ? 3 : margin < 0.5 ? 4 : 5;
      const best = [...sales].sort((a, b) => b.sold / b.prepared - a.sold / a.prepared)[0];
      const memo = weather === "비" ? "비가 와서 손님이 적었음" : best.sold / best.prepared > 0.85 ? `${best.product_name} 거의 다 팔림` : null;
      Object.assign(row, {
        total_revenue: total,
        transport_cost: transport,
        parking_cost: parking,
        net_profit: net,
        satisfaction,
        would_reattend: satisfaction >= 4,
        weather,
        indoor_outdoor: pick(["실내", "실외"]),
        memo,
        // [가정] 70%는 참가 전에 목표 매출을 적어 둠 — 실제 매출의 80~130% 수준(목표 달성률 지표용)
        target_revenue: rand() < 0.7 ? Math.max(1000, Math.round((total * (0.8 + rand() * 0.5)) / 1000) * 1000) : null,
      });
      if (regular) {
        Object.assign(row, {
          ...booth(),
          lodging_cost: lodging,
          other_cost: other,
          operating_hours: pick(C.REGULAR.hours),
          perceived_crowd: weather === "비" ? "적음" : pick(["보통", "많음", "매우 많음"]),
          operation_satisfaction: int(2, 5),
          parking_convenience: int(1, 5),
          promotion_quality: int(2, 5),
          booth_number: `${pick(["A", "B", "C"])}-${int(1, 30)}`,
          booth_location_rating: int(2, 5),
          payment_methods_used: paymentMethods.filter(() => rand() < 0.8),
          memo: memo ?? (rand() < 0.7 ? pick(C.REGULAR.memos) : null),
        });
      }
    } else if (status === "planning_to_attend") {
      // 단골은 지난 매출 평균 근처로 예상 매출을 잡는다.
      const avg = revenues.length ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;
      const expected = regular && avg ? Math.round((avg * (0.9 + rand() * 0.2)) / 1000) * 1000 : won(150000, 600000);
      Object.assign(row, { expected_revenue: expected, target_revenue: Math.round((expected * 1.2) / 1000) * 1000 });
      if (regular) {
        Object.assign(row, booth());
        for (const prod of productRows) {
          sales.push({ product_id: prod.id, product_name: prod.name, prepared: int(...C.REGULAR.prepared), sold: 0, price: Number(prod.price) });
        }
      }
    }

    const { data: part, error: partError } = await db.from("event_participations").insert(row).select("id").single();
    if (partError || !part) throw partError;
    if (sales.length) {
      const { error: salesError } = await db.from("event_product_sales").insert(sales.map((s) => ({ ...s, participation_id: part.id })));
      if (salesError) throw salesError;
    }
    if (status === "planning_to_attend" && p.edge !== "empty_checklist") {
      const labels = [...C.CHECKLIST, ...(isFood ? C.FOOD_CHECKLIST : [])];
      const custom = regular ? C.REGULAR.customChecklist : [];
      const { error: checkError } = await db.from("event_checklists").insert([
        ...labels.map((label, k) => ({ participation_id: part.id, label, checked: rand() < 0.4, is_custom: false, sort_order: k })),
        ...custom.map((label, k) => ({ participation_id: part.id, label, checked: rand() < 0.4, is_custom: true, sort_order: labels.length + k })),
      ]);
      if (checkError) throw checkError;
    }
  }

  // 단골은 첫 참가 한 달 전에 가입·가게 등록한 것으로 날짜를 맞춘다.
  if (regular && chosen.length) {
    const joined = new Date(chosen[0].start_date!);
    joined.setDate(joined.getDate() - 30);
    await db.from("profiles").update({ created_at: joined.toISOString() }).eq("id", userId);
    await db.from("stores").update({ created_at: joined.toISOString() }).eq("id", store.id);
  }
  return chosen.length;
}

async function main() {
  const personas = buildPersonas();
  printValidation(personas);
  if (process.argv.includes("--dry-run")) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.SYNTHETIC_USER_PASSWORD;
  if (!url || !serviceKey || !password) {
    console.error("\n.env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNTHETIC_USER_PASSWORD가 필요합니다.");
    process.exit(1);
  }
  const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  const { data: events, error } = await db.from("events").select("id, region, start_date, end_date, event_recruitments(fee)");
  if (error) throw error;
  if (!events?.length) throw new Error("events 테이블이 비어 있어요. 먼저 npm run seed:events를 실행하세요.");

  await deleteExistingSynthetic(db);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  console.log("");
  for (const p of personas) {
    const n = await seedPersona(db, p, events as EventRow[], password, today);
    console.log(`✓ ${p.email} ${p.name} · ${p.category} · 참가 ${n ?? 0}건${p.edge ? ` · ${p.edge}` : ""}${C.REGULARS.includes(p.no) ? " · 단골" : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
