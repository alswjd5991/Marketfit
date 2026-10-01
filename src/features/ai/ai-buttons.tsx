"use client";

// AI 도우미 폼들의 제출 버튼/입력창 — 전송 중(pending)엔 비활성화 + 로딩 표시로 바꿔서
// 사용자가 응답을 기다리다 무의식적으로 다시 눌러 요청이 중복 발사되는 걸 막는다.
// (무료 등급 RPM이 5로 낮아서, 중복 클릭 몇 번만으로도 Gemini API 429를 유발할 수 있었음.)
// useFormStatus는 <form> 하위의 클라이언트 컴포넌트에서만 쓸 수 있어 별도 파일로 분리.

import { useFormStatus } from "react-dom";
import { ArrowUp, BarChart3, FileText, Loader2, Search } from "lucide-react";

/**
 * 메시지 입력창 — 한 줄로 시작해 글이 길어지면 field-sizing으로 세로가 늘어난다(최대 max-h, 넘치면 스크롤).
 * Enter 전송, Shift+Enter 줄바꿈. 전송 중엔 비활성화.
 */
export function MessageInput() {
  const { pending } = useFormStatus();
  return (
    <textarea
      name="content"
      autoComplete="off"
      aria-label="메시지"
      rows={1}
      placeholder={pending ? "답변을 기다리는 중..." : "궁금한 내용을 편하게 물어보세요"}
      disabled={pending}
      onKeyDown={(e) => {
        // 한글 조합 중 Enter는 글자 확정용이라 전송하지 않는다.
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      className="max-h-40 w-full flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-7 text-neutral-900 outline-none [field-sizing:content] placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400"
    />
  );
}

/** 입력창 오른쪽 아래 사각 전송 버튼. */
export function SendMessageButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label="보내기"
      disabled={pending}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/30 transition-colors hover:bg-brand-dark disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.5} />}
    </button>
  );
}

const SUGGESTIONS = [
  { icon: BarChart3, label: "내 매출 분석", preset: "sales" },
  { icon: Search, label: "행사 찾기", preset: "events" },
  { icon: FileText, label: "참가 준비", preset: "prep" },
];

/**
 * 빈 화면의 추천 칩 — 누르면 preset 키를 보내고 서버(actions.ts PRESETS)가 질문 문장으로 바꿔 답한다.
 * 같은 폼의 입력창이 이미 name="content"라 칩은 다른 이름을 써야 빈 입력값에 가려지지 않는다.
 */
export function SuggestionChips() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {SUGGESTIONS.map(({ icon: Icon, label, preset }) => (
        <button
          key={label}
          type="submit"
          name="preset"
          value={preset}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-full border border-white bg-white/80 px-3.5 py-2 text-[13px] font-medium text-neutral-800 shadow-sm shadow-neutral-900/5 backdrop-blur transition-colors hover:border-brand/30 hover:text-brand disabled:pointer-events-none disabled:opacity-50"
        >
          <Icon className="size-4 text-brand" />
          {label}
        </button>
      ))}
    </div>
  );
}
