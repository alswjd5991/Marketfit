"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// 스크롤 중간에 한 번 바뀌는 두 가지 톤: 앞 두 섹션은 햇살 오후, 뒤 두 섹션은 맑은 하늘.
// 첫 화면(살구·하늘)과 구분되게 고른 색이며, base는 패널 전체 바탕, clouds는 구름 원 색(CLOUDS 순서).
const PALETTES = [
  {
    base: "linear-gradient(180deg, #FFF9E6 0%, #FFF6EE 50%, #FFF0EC 100%)",
    clouds: ["#FFE074", "#FFA394", "#FFFFFF"],
  },
  {
    base: "linear-gradient(180deg, #EEF6FF 0%, #F2FAF8 50%, #EAF4FF 100%)",
    clouds: ["#8EC8FF", "#8FE0CB", "#FFFFFF"],
  },
];

// 이 섹션 순서부터 두 번째 톤으로 바뀐다.
const PALETTE_SWITCH_AT = 2;

// 구름 원 세 가지의 크기와 흐르는 방향
const CLOUDS = [
  { size: 620, drift: ["70px", "-40px"] },
  { size: 560, drift: ["-60px", "30px"] },
  { size: 520, drift: ["50px", "40px"] },
];

// 섹션이 바뀔 때마다 구름이 옮겨 갈 자리(섹션 안에서의 x%, y%). 순서는 CLOUDS와 같다.
const LAYOUTS = [
  [[10, 20], [82, 62], [45, 92]],
  [[78, 14], [12, 72], [55, 38]],
  [[30, 80], [88, 18], [6, 32]],
  [[86, 64], [38, 8], [18, 86]],
];

const BANDS = [0, 1, 2, 3];

/**
 * 구름 원들이 천천히 흘러가는 배경. data-sky 섹션이 바뀔 때마다 구름이 새 자리로
 * 미끄러지듯 이동하고, 중간 섹션부터는 바탕과 구름 색이 두 번째 톤으로 바뀐다.
 * 첫 화면(히어로)에 있을 때는 배경을 숨겨 패널 기본 흰색이 보인다.
 */
export function SkyBackground() {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-sky]");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.sky);

          if (entry.isIntersecting) {
            setActive(index);
          } else if (index === 0 && entry.boundingClientRect.top > 0) {
            // 첫 섹션이 아래로 빠졌다 = 히어로로 돌아감
            setActive(-1);
          }
        }
      },
      { threshold: 0.5 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const layout = LAYOUTS[Math.max(active, 0)];
  const phase = active >= PALETTE_SWITCH_AT ? 1 : 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-t-[56px] transition-opacity duration-700 ease-out",
        active === -1 ? "opacity-0" : "opacity-100"
      )}
    >
      {/* 바탕: 두 톤을 겹쳐 두고 현재 톤만 보이게 */}
      {PALETTES.map((palette, p) => (
        <div
          key={p}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            phase === p ? "opacity-100" : "opacity-0"
          )}
          style={{ background: palette.base }}
        />
      ))}

      {BANDS.flatMap((band) =>
        CLOUDS.map((cloud, i) => (
          <div
            key={`${band}-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[1600ms] ease-in-out"
            style={{
              left: `${layout[i][0]}%`,
              top: `${band * 25 + layout[i][1] * 0.25}%`,
            }}
          >
            <div
              className="sky-cloud relative rounded-full"
              style={{
                width: cloud.size,
                height: cloud.size,
                ["--drift-x" as string]: cloud.drift[0],
                ["--drift-y" as string]: cloud.drift[1],
              }}
            >
              {/* 구름 색도 두 톤을 겹쳐 두고 바꿔 보여준다 */}
              {PALETTES.map((palette, p) => (
                <div
                  key={p}
                  className={cn(
                    "absolute inset-0 rounded-full transition-opacity duration-1000 ease-in-out",
                    phase === p ? "opacity-100" : "opacity-0"
                  )}
                  style={{
                    background: `radial-gradient(circle, ${palette.clouds[i]}B3 0%, transparent 68%)`,
                  }}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
