"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

const TRIGGER = {
  // 폼 입력칸
  field:
    "flex h-11 w-full items-center justify-between gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-3.5 text-left text-sm text-neutral-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-neutral-300 hover:bg-[#FAFCFE]",
  // 박스 없는 글자형(행사 찾기 필터)
  text: "flex items-center gap-1.5 bg-transparent py-1 text-[15px] font-medium text-neutral-600 transition-colors hover:text-neutral-950",
  // 둥근 알약형(차트 제목 옆)
  pill: "flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-white pl-3 pr-2.5 text-[13px] text-neutral-700 transition-colors hover:border-neutral-300",
};

/**
 * 사이트 공용 드롭다운. 브라우저 기본 <select>는 펼친 옵션 목록을 꾸밀 수 없어서 직접 그린다.
 * name을 주면 숨은 input으로 폼에 값이 함께 제출된다. 키보드: ↑↓ 이동, Enter 선택, Esc 닫기.
 */
export function SelectMenu({
  options,
  name,
  defaultValue = "",
  value,
  onChange,
  ariaLabel,
  variant = "field",
  active = false,
  align = "left",
  className,
}: {
  options: SelectOption[];
  name?: string;
  defaultValue?: string;
  /** 주면 제어 컴포넌트로 동작 */
  value?: string;
  onChange?: (value: string) => void;
  ariaLabel: string;
  variant?: keyof typeof TRIGGER;
  /** text 변형에서 "선택됨" 강조 */
  active?: boolean;
  align?: "left" | "right";
  className?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const selected = value ?? inner;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === selected) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(v: string) {
    if (value === undefined) setInner(v);
    onChange?.(v);
    setOpen(false);
  }

  function toggle() {
    setCursor(Math.max(0, options.findIndex((o) => o.value === selected)));
    setOpen((o) => !o);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      return toggle();
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(options.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[cursor].value);
    }
  }

  return (
    <div ref={boxRef} className={cn("relative", variant === "field" && "w-full", className)} onKeyDown={onKeyDown}>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
        className={cn(
          TRIGGER[variant],
          "outline-none focus-visible:ring-2 focus-visible:ring-brand/25",
          variant === "text" && active && "font-bold text-brand-dark underline decoration-brand/40 decoration-2 underline-offset-8 hover:text-brand-dark"
        )}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            open && "rotate-180",
            variant === "text" && active ? "text-brand-dark" : "text-neutral-400"
          )}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute top-full z-40 mt-2 max-h-[360px] min-w-full w-max max-w-[280px] overflow-y-auto rounded-xl [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-track]:bg-transparent border border-neutral-200/80 bg-white p-1.5 shadow-[0_12px_32px_rgba(40,80,120,0.16)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((o, i) => {
            const isSelected = o.value === selected;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                  i === cursor && "bg-[#F1F7FC]",
                  isSelected ? "font-semibold text-brand-dark" : "text-neutral-700"
                )}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && <Check className="size-4 shrink-0 text-brand" strokeWidth={2.5} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
