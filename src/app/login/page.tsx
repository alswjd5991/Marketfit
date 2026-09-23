import Link from "next/link";
import { signIn } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-bold text-neutral-950">로그인</h1>
      <p className="mt-1 text-sm text-neutral-500">
        내 가게를 등록하고 참가 기록을 관리하려면 로그인하세요.
      </p>

      {notice && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form action={signIn} className="mt-6 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="이메일"
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="비밀번호"
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <Button type="submit">로그인</Button>
      </form>

      <p className="mt-4 text-center text-sm text-neutral-500">
        계정이 없으신가요? <Link href="/signup" className="underline">회원가입</Link>
      </p>
    </div>
  );
}
