"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-zinc-100 text-black hover:bg-white font-medium text-[13px] rounded-md px-4 py-2 transition-all duration-150",
  secondary:
    "bg-transparent border border-white/10 text-zinc-300 hover:bg-white/5 font-medium text-[13px] rounded-md px-4 py-2 transition-all duration-150",
  ghost:
    "bg-transparent text-zinc-400 hover:text-zinc-200 font-medium text-[13px] rounded-md px-3 py-1.5 transition-all duration-150",
};

const sizes = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-4 py-2 text-[13px]",
  lg: "px-5 py-2.5 text-[14px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none disabled:opacity-50 select-none",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, type ButtonProps };
