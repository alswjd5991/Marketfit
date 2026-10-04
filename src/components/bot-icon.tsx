import { cn } from "@/lib/utils";

const mask = (src: string) => ({ mask: `url(${src}) center / contain no-repeat`, WebkitMask: `url(${src}) center / contain no-repeat` });

/** 챗봇 아이콘: PNG를 마스크로 써서 currentColor(text-*)로 색을 입힌다. 실루엣은 옅게 채우고 선은 진하게 */
export function BotIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block shrink-0", className)}>
      <span className="absolute inset-0 bg-current opacity-40" style={mask("/chatbot-fill.png")} />
      <span className="absolute inset-0 bg-current" style={mask("/chatbot.png")} />
    </span>
  );
}
