import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWeeklyEventSync } from "@/features/events/weekly-sync";

// 매주 월요일 09:00(KST) Vercel Cron이 호출한다 — vercel.json의 crons 참고.
// Vercel은 Cron 요청에 `Authorization: Bearer ${CRON_SECRET}` 헤더를 붙여 보내므로,
// 같은 값을 아는 요청만 실행한다(외부에서 마음대로 DB 쓰기를 일으키지 못하게).
// 수동 점검: curl -H "Authorization: Bearer $CRON_SECRET" "https://<도메인>/api/cron/weekly-events?dryRun=1"
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.has("dryRun");
  const supabase = createAdminClient();
  if (!dryRun && !supabase) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const report = await runWeeklyEventSync({ supabase, dryRun, tourKey: process.env.TOUR_API_KEY?.trim() });
    console.log("[weekly-events]", JSON.stringify(report));
    if (!dryRun && report.created + report.updated > 0) {
      revalidatePath("/events");
      revalidatePath("/");
    }
    const allFailed = report.sources.every((s) => s.error);
    return Response.json(report, { status: allFailed ? 502 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[weekly-events] 실패:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
