"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 61번 항목(보안): 모든 인증은 서버 액션 안에서만 처리한다. 클라이언트에는
 * anon key 이상의 어떤 비밀도 넘기지 않는다.
 */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/store");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");

  if (password.length < 6) {
    redirect(`/signup?error=${encodeURIComponent("비밀번호는 6자 이상이어야 합니다.")}`);
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // 이메일 확인이 켜져 있으면 세션이 바로 생기지 않는다 — 상황에 맞게 안내.
  if (!data.session) {
    redirect("/login?notice=" + encodeURIComponent("가입 확인 이메일을 보냈습니다. 확인 후 로그인해 주세요."));
  }

  redirect("/store");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
