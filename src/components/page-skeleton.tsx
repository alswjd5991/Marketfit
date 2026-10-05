import { skyGradient, type SkyLevel } from "@/components/sky-page";

const BLOCK = "animate-pulse rounded-2xl bg-white/70";

/**
 * 페이지 로딩 화면(loading.tsx 공용). 메뉴를 누르면 서버 응답을 기다리지 않고 이 뼈대가 바로 뜬다.
 * 배경은 실제 페이지와 같은 노을 단계를 써서 화면이 깜빡이지 않게 한다.
 */
export function PageSkeleton({ level = 0, variant = "cards" }: { level?: SkyLevel; variant?: "cards" | "panels" | "list" | "detail" }) {
  return (
    <div className="min-h-screen" style={{ background: skyGradient(level) }} aria-busy="true" aria-label="불러오는 중">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className={`h-9 w-40 ${BLOCK}`} />

        {variant === "cards" && (
          <>
            <div className={`mt-8 h-11 w-full ${BLOCK}`} />
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={`h-80 ${BLOCK}`} />
              ))}
            </div>
          </>
        )}

        {variant === "panels" && (
          <>
            <div className={`mt-8 h-36 ${BLOCK}`} />
            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className={`h-[520px] ${BLOCK}`} />
              <div className={`h-[520px] ${BLOCK}`} />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={`h-36 ${BLOCK}`} />
              ))}
            </div>
          </>
        )}

        {variant === "list" && (
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`h-28 ${BLOCK}`} />
            ))}
          </div>
        )}

        {variant === "detail" && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
            <div className="space-y-5">
              <div className={`aspect-[16/9] ${BLOCK}`} />
              <div className={`h-8 w-2/3 ${BLOCK}`} />
              <div className={`h-40 ${BLOCK}`} />
            </div>
            <div className={`h-72 ${BLOCK}`} />
          </div>
        )}
      </div>
    </div>
  );
}
