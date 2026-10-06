// 대시보드 분석 데이터 — 서버 전용(로그인한 가게 기준). 계산은 compute.ts.
//
// ①③④는 여러 가게의 기록을 함께 써야 해서 service_role로 전체 참가 기록을 읽는다(RLS상 사용자는
// 자기 기록만 읽을 수 있음). 다른 가게의 원본 기록은 서버 밖으로 나가지 않고, 화면에는
// 회귀계수·예측값·순위 같은 요약값만 전달된다. 클라이언트 컴포넌트에서 import 금지.

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyStore } from "@/features/store/data";
import { computeAnalytics, type DashboardAnalytics } from "./compute";

export type { DashboardAnalytics, ForecastItem } from "./compute";

export const getDashboardAnalytics = cache(async (): Promise<DashboardAnalytics | null> => {
  const store = await getMyStore();
  const db = createAdminClient();
  if (!store || !db) return null;
  try {
    return await computeAnalytics(db, store.id);
  } catch (err) {
    console.error("[analytics]", err instanceof Error ? err.message : err);
    return null; // 분석이 실패해도 대시보드의 기본 통계는 그대로 보인다
  }
});

