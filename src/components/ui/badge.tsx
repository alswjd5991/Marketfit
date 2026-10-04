import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-white",
        secondary: "border-transparent bg-neutral-100 text-neutral-600",
        outline: "border-neutral-200 text-neutral-700",
        success: "border-transparent bg-emerald-100 text-emerald-800",
        warning: "border-transparent bg-[#FFEEDD] text-[#B4530A]", // 마감 D-day (햇살 주황)
        muted: "border-transparent bg-neutral-200 text-neutral-500", // 모집 종료 배지 등
        sample: "border-dashed border-neutral-300 text-neutral-500", // 합성 데이터 표시(style.badge_syn 계승)
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
