"use client";

/** 체크하면 바로 저장되는 체크리스트 항목. 결제수단 체크박스와 같은 기본 체크박스를 쓰고, 취소선은 CSS(peer-checked)로 즉시 반영한다. */
export function ChecklistCheckbox({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        name="next_checked"
        value="true"
        defaultChecked={checked}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="peer size-4 shrink-0 rounded border-neutral-300 accent-brand"
      />
      <span className="text-neutral-900 peer-checked:text-neutral-400 peer-checked:line-through">{label}</span>
    </label>
  );
}
