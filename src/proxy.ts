import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` (export `proxy`, not
// `middleware`). This refreshes the Supabase auth session cookie on every
// request so Server Components always see a valid session.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  // Supabase가 아직 연결되지 않은 초기 단계(Phase 1)에서는 세션 갱신을
  // 건너뛰고 그대로 통과시킨다 — 이게 없으면 요청마다 500 에러가 나서
  // 사이트 전체가 멈춘다(62번 항목: 오류가 나도 전체 사이트는 멈추지 않아야 함).
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if needed — do not remove, and do not run logic
  // between client creation and this call (see Supabase SSR docs).
  // Wrapped in try/catch: a network blip to Supabase must not 500 every
  // page on the site (62번 항목) — worst case, the session just doesn't
  // refresh on this one request.
  // getClaims도 만료된 세션은 갱신하고, ES256 서명 키라 토큰 검증을 네트워크 왕복 없이 끝낸다
  // (store/data.ts의 getCurrentUser와 같은 이유).
  try {
    await supabase.auth.getClaims();
  } catch {
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
