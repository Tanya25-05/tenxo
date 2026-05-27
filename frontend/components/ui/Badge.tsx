import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "accent";
}

const variantStyles = {
  default: "border-white/10 bg-white/5 text-zinc-300",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  accent: "border-accent-purple/20 bg-accent-purple/10 text-accent-purple",
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center border px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium",
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
Badge.displayName = "Badge";

export { Badge, type BadgeProps };
