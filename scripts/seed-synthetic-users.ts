// 실행: npm run seed:synthetic -- --dry-run   (DB를 건드리지 않고 구성·통계 검증표·생성 요약만 출력)
//       npm run seed:synthetic                (기존 합성 유저를 지우고 200명을 다시 만든다)
//
// 생성 과정은 scripts/synthetic/dgp.ts, 수치·가정·출처는 scripts/synthetic-users.config.ts 참고.
// 시드가 고정이라 같은 행사·날씨 자료면 다시 실행해도 같은 200명이 나온다.
//
// 순서 권장: (1) npm run sync:events -- --from 2024-01-01 --to <어제>  (과거 행사 수집)
//            (2) npm run seed:synthetic                                (그 행사들로 합성 셀러 생성)
// 필요한 키(.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNTHETIC_USER_PASSWORD,
//   DATA_GO_KR_KEY(선택 — 기상청 실측 날씨. 없으면 [가정] 분포로 대체하고 그 사실을 출력).

import { config } from "dotenv";
config({ path: ".env.local" });

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { seedEvents } from "../src/lib/data/seed-events";
import { getCategoryGroup } from "../src/features/events/category-group";
import * as C from "./synthetic-users.config";
import { generateAll, quotas, type DgpEvent, type GenSeller, type Persona } from "./synthetic/dgp";
import { loadWeather } from "./synthetic/weather";

type Db = ReturnType<typeof createClient<Database>>;
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

// ---------------------------------------------------------------------------
// 행사 불러오기(DB 또는 로컬 시드 파일)
// ---------------------------------------------------------------------------
const seedById = new Map(seedEvents.map((e) => [`${e.sourceDataset}:${e.id}`, e]));

export async function loadDbEvents(db: Db): Promise<DgpEvent[]> {
  const rows: { id: string; name: string; category: string | null; region: string | null; start_date: string | null; end_date: string | null; event_recruitments: { fee: number | null; source_post_id: string | null }[] }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("events").select("id, name, category, region, start_date, end_date, event_recruitments(fee, source_post_id)").order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }
  return rows.filter((r) => r.start_date).map((r) => {
    const rec = r.event_recruitments?.[0];
    const seed = rec?.source_post_id ? seedById.get(rec.source_post_id) : undefined;
    return {
      id: r.id, key: rec?.source_post_id ?? r.id, name: r.name, region: r.region,
      startDate: r.start_date!, endDate: r.end_date,
      fee: rec?.fee == null ? null : Number(rec.fee),
      outdoor: seed?.outdoor ?? null,
      group: getCategoryGroup(r.category, r.name),
    };
  });
}

export function loadSeedFileEvents(): DgpEvent[] {
  return seedEvents.filter((e) => e.startDate).map((e) => ({
    id: `${e.sourceDataset}:${e.id}`, key: `${e.sourceDataset}:${e.id}`, name: e.name, region: e.region,
    startDate: e.startDate!, endDate: e.endDate, fee: e.feeKrw, outdoor: e.outdoor, group: getCategoryGroup(e.category, e.name),
  }));
}

export async function loadEventWeather(events: DgpEvent[]) {
  const years = [...new Set(events.filter((e) => e.startDate < today).map((e) => Number(e.startDate.slice(0, 4))))].filter((y) => y >= 2000);
  return loadWeather(process.env.DATA_GO_KR_KEY?.trim(), [...new Set(events.map((e) => e.region).filter(Boolean) as string[])], years, today);
}

// ---------------------------------------------------------------------------
// 검증표·요약
// ---------------------------------------------------------------------------
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
}

export function printSummary(sellers: GenSeller[], events: DgpEvent[], cond: ReturnType<typeof generateAll>["cond"]) {
  const attended = sellers.flatMap((s) => s.participations.filter((p) => p.result));
  const counts = sellers.filter((s) => s.traits).map((s) => s.participations.filter((p) => p.result).length);
  const share = (f: (n: number) => boolean) => `${Math.round((counts.filter(f).length / counts.length) * 100)}%`;
  const usedEvents = new Set(attended.map((p) => p.event.id));
  const observed = [...usedEvents].filter((id) => cond.get(id)!.weatherObserved).length;
  const revenues = attended.map((p) => p.result!.totalRevenue).sort((a, b) => a - b);
  const stockouts = attended.flatMap((p) => p.sales).filter((s) => s.sold >= s.prepared).length;
  const saleCount = attended.flatMap((p) => p.sales).length;
  console.log(`\n■ 생성 요약`);
  console.log(`  행사 ${events.length}곳(지난 행사 ${events.filter((e) => (e.endDate ?? e.startDate) < today).length}곳) 중 참가 기록이 있는 행사 ${usedEvents.size}곳`);
  console.log(`  날씨: 기상청 실측 ${observed}곳 / [가정] 분포 ${usedEvents.size - observed}곳`);
  console.log(`  참가 완료 기록 ${attended.length}건 · 셀러당 0건 ${share((n) => n === 0)} · 1~2건 ${share((n) => n >= 1 && n <= 2)} · 3~9건 ${share((n) => n >= 3 && n < 10)} · 10건 이상 ${share((n) => n >= 10)}`);
  console.log(`  행사당 매출 중앙값 ${revenues[Math.floor(revenues.length / 2)]?.toLocaleString()}원 · 상품별 품절 비율 ${Math.round((stockouts / saleCount) * 100)}%`);
  const byCat = new Map<string, number>();
  for (const s of sellers) if (s.participations.filter((p) => p.result).length >= 3) byCat.set(s.persona.category, (byCat.get(s.persona.category) ?? 0) + 1);
  console.log(`  카테고리별 '매출 기록 3건 이상' 가게: ${[...byCat].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
}

// ---------------------------------------------------------------------------
// DB 적재
// ---------------------------------------------------------------------------
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

async function writeSeller(db: Db, s: GenSeller, password: string) {
  const p = s.persona;
  const { data: created, error } = await db.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { synthetic: true } });
  if (error || !created.user) throw error ?? new Error("유저 생성 실패");
  const userId = created.user.id;
  await db.from("profiles").update({ name: p.name }).eq("id", userId);
  if (!s.traits) return;
  const t = s.traits;
  const isFood = ["음식", "디저트", "농산물"].includes(p.category);
  const { data: store, error: storeError } = await db.from("stores").insert({
    owner_id: userId, name: `${p.given}네 ${p.category}`, category: p.category, flagship_product: t.products[0].name,
    active_region: p.edge === "no_region" ? null : p.region, payment_methods: t.paymentMethods, hygiene_certified: isFood ? true : null,
    created_at: new Date(`${t.since}T09:00:00+09:00`).toISOString(),
  }).select("id").single();
  if (storeError || !store) throw storeError;
  await db.from("profiles").update({ created_at: new Date(`${t.since}T09:00:00+09:00`).toISOString() }).eq("id", userId);

  const { data: productRows, error: productError } = await db.from("products")
    .insert(t.products.map((x) => ({ store_id: store.id, name: x.name, category: p.category, price: x.price, cost: x.cost }))).select("id, name");
  if (productError || !productRows) throw productError;
  const productId = (i: number) => productRows.find((r) => r.name === t.products[i].name)!.id;
  if (!s.participations.length) return;

  const R = C.EVENT_RESULT;
  const rows = s.participations.map((g, k) => {
    const pick = <T,>(arr: readonly T[]) => arr[(p.no * 7 + k * 3) % arr.length]; // 선택 항목 값 — 결정적으로 고름
    const row: Database["public"]["Tables"]["event_participations"]["Insert"] = {
      store_id: store.id, event_id: g.event.id, status: g.status, fee: g.fee,
      expected_revenue: g.expectedRevenue, target_revenue: g.targetRevenue,
      created_at: new Date(`${g.recordedAt}T12:00:00+09:00`).toISOString(),
    };
    if (g.result) {
      const r = g.result;
      const best = [...g.sales].sort((a, b) => b.sold / b.prepared - a.sold / a.prepared)[0];
      Object.assign(row, {
        total_revenue: r.totalRevenue, transport_cost: r.transport, parking_cost: r.parking, lodging_cost: r.lodging, other_cost: r.other,
        net_profit: r.netProfit, satisfaction: r.satisfaction, would_reattend: r.satisfaction >= 4,
        weather: g.cond.weather, indoor_outdoor: g.cond.outdoor ? "실외" : "실내",
        memo: g.cond.weather === "비" ? "비가 와서 손님이 적었음" : best && best.sold >= best.prepared ? `${t.products[best.productIndex].name} 다 팔림` : null,
      });
      if (r.detailed) {
        Object.assign(row, {
          booth_provided: pick(["organizer", "self"]), booth_size: pick(R.boothSize), power_available: k % 3 !== 0, vehicle_access: k % 2 === 0,
          operating_hours: pick(R.hours), perceived_crowd: g.cond.weather === "비" ? "적음" : pick(["보통", "많음", "매우 많음"]),
          booth_number: `${pick(["A", "B", "C"])}-${1 + ((p.no + k) % 30)}`, booth_location_rating: 2 + ((p.no + k) % 4),
          payment_methods_used: t.paymentMethods, memo: (row as { memo?: string | null }).memo ?? pick(R.memos),
        });
      }
    }
    return row;
  });
  const { data: parts, error: partError } = await db.from("event_participations").insert(rows).select("id, event_id");
  if (partError || !parts) throw partError;
  const partId = new Map(parts.map((x) => [x.event_id, x.id]));

  const sales = s.participations.flatMap((g) => g.sales.map((x) => ({
    participation_id: partId.get(g.event.id)!, product_id: productId(x.productIndex), product_name: t.products[x.productIndex].name,
    prepared: x.prepared, sold: g.status === "attended" ? x.sold : 0, price: x.price,
  })));
  if (sales.length) {
    const { error: salesError } = await db.from("event_product_sales").insert(sales);
    if (salesError) throw salesError;
  }
  const checklists = s.participations.filter((g) => g.status === "planning_to_attend" && p.edge !== "empty_checklist").flatMap((g) => {
    const labels = [...C.CHECKLIST, ...(isFood ? C.FOOD_CHECKLIST : [])];
    return labels.map((label, k) => ({ participation_id: partId.get(g.event.id)!, label, checked: k % 3 === 0, is_custom: false, sort_order: k }));
  });
  if (checklists.length) {
    const { error: checkError } = await db.from("event_checklists").insert(checklists);
    if (checkError) throw checkError;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = url && serviceKey ? createClient<Database>(url, serviceKey, { auth: { persistSession: false } }) : null;

  const events = db && !process.argv.includes("--seed-file") ? await loadDbEvents(db) : loadSeedFileEvents();
  if (!events.length) throw new Error("행사가 없어요. 먼저 npm run seed:events / sync:events를 실행하세요.");
  const weather = await loadEventWeather(events);
  if (!weather) console.warn("※ 기상청 실측 날씨를 쓰지 못해 [가정] 날씨 분포로 생성합니다(DATA_GO_KR_KEY 확인).");
  const { personas, cond, sellers } = generateAll(events, weather, today);
  printValidation(personas);
  printSummary(sellers, events, cond);
  if (dryRun) return;

  const password = process.env.SYNTHETIC_USER_PASSWORD;
  if (!db || !password) {
    console.error("\n.env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNTHETIC_USER_PASSWORD가 필요합니다.");
    process.exit(1);
  }
  await deleteExistingSynthetic(db);
  console.log("");
  for (const s of sellers) {
    await writeSeller(db, s, password);
    const n = s.participations.filter((g) => g.result).length;
    console.log(`✓ ${s.persona.email} ${s.persona.name} · ${s.persona.category} · 참가 완료 ${n}건${s.persona.edge ? ` · ${s.persona.edge}` : ""}`);
  }
}

if (process.argv[1]?.includes("seed-synthetic-users")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
