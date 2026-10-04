"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function AuthSubmitButton({ mode }: { mode: "login" | "signup" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      <span aria-live="polite">
        {pending ? (mode === "login" ? "로그인 중…" : "가입 처리 중…") : (mode === "login" ? "로그인" : "가입하기")}
      </span>
    </Button>
  );
}
