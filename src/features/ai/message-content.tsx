import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";

/**
 * HTML은 실행하지 않고 링크는 react-markdown의 안전한 URL 변환을 거친다.
 * remark-cjk-friendly: "**가게 (민정)**의"처럼 문장부호 뒤 닫는 **에 한글이 바로 붙어도 강조로 인식하게 한다
 * (CommonMark 기본 규칙에선 강조가 풀려 **가 그대로 보였음).
 */
export function MessageContent({ content }: { content: string }) {
  return (
    <div className="min-w-0 space-y-3 break-words text-sm leading-7 text-neutral-800 [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCjkFriendly]} skipHtml components={{
        h1: ({ children }) => <h3 className="pt-2 font-normal text-neutral-950">{children}</h3>,
        h2: ({ children }) => <h3 className="pt-2 font-normal text-neutral-950">{children}</h3>,
        h3: ({ children }) => <h3 className="pt-2 font-normal text-neutral-950">{children}</h3>,
        p: ({ children }) => <p className="whitespace-pre-line">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-neutral-950">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc space-y-2 pl-5 marker:text-neutral-400">{children}</ul>,
        ol: ({ children, start }) => <ol start={start} className="list-decimal space-y-3 pl-5 marker:text-neutral-500">{children}</ol>,
        li: ({ children }) => <li className="pl-1 [&>p+p]:mt-1">{children}</li>,
        a: ({ href, children }) => href
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand">{children}</a>
          : <span>{children}</span>,
        img: ({ alt }) => <span className="text-neutral-500">{alt}</span>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-neutral-300 pl-3 text-neutral-600">{children}</blockquote>,
        table: ({ children }) => <div className="max-w-full overflow-x-auto rounded-2xl border border-neutral-200"><table className="w-full border-collapse text-left text-xs leading-6">{children}</table></div>,
        th: ({ children }) => <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 font-normal">{children}</th>,
        td: ({ children }) => <td className="border-b border-neutral-100 px-3 py-2 align-top">{children}</td>,
        pre: ({ children }) => <pre className="overflow-x-auto rounded-2xl bg-neutral-100 p-4 text-xs">{children}</pre>,
        code: ({ children }) => <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.9em]">{children}</code>,
      }}>{content}</ReactMarkdown>
    </div>
  );
}
