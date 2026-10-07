import Link from "next/link";
import { skyGradient } from "@/components/sky-page";
import { signIn } from "@/features/auth/actions";
import { AuthSubmitButton } from "@/features/auth/submit-button";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;

  return (
    <div className="min-h-screen" style={{ background: skyGradient(0) }}>
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-neutral-950">로그인</h1>

      {notice && (
        <p className="mt-4 rounded-lg bg-[#E0EFE8] px-3 py-2 text-sm text-[#2F5F4B]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#FFE4DE] px-3 py-2 text-sm text-[#BE3A2A]">{error}</p>
      )}

      <form action={signIn} className="mt-6 flex flex-col gap-3">
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
          autoComplete="current-password"
          type="password"
          required
          placeholder="비밀번호"
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <AuthSubmitButton mode="login" />
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        계정이 없다면 <Link href="/signup" className="underline">회원가입</Link>
      </p>
    </div>
    </div>
  );
}
