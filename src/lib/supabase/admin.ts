import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * service_role 키로 RLS를 우회하는 서버 전용 클라이언트. events/event_recruitments는
 * 공개 읽기만 허용돼 있어(0001_init.sql) 주간 행사 자동 수집처럼 서버가 직접 쓰는
 * 작업에만 쓴다. Route Handler·스크립트 외(클라이언트 컴포넌트)에서 import 금지.
 * 키가 없으면 null.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
}
