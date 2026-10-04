import Link from "next/link";
import { signUp } from "@/features/auth/actions";
import { AuthSubmitButton } from "@/features/auth/submit-button";

export default async function SignupPage(props: PageProps<"/signup">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-neutral-950">회원가입</h1>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={signUp} className="mt-6 flex flex-col gap-3">
        <input
          name="name"
          aria-label="이름 (선택)"
          autoComplete="name"
          type="text"
          placeholder="이름 (선택)"
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <input
          name="email"
          aria-label="이메일"
          autoComplete="email"
          type="email"
          required
          placeholder="이메일"
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <input
          name="password"
          aria-label="비밀번호"
          autoComplete="new-password"
          type="password"
          required
          minLength={6}
          placeholder="비밀번호 (6자 이상)"
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <AuthSubmitButton mode="signup" />
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        이미 계정이 있으신가요? <Link href="/login" className="underline">로그인</Link>
      </p>
    </div>
  );
}
