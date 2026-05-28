import { useId } from "react";

interface LogoProps {
  size?: number;
  className?: string;
  gradient?: boolean;
}

export function Logo({ size = 28, className, gradient }: LogoProps) {
  const id = useId();

  if (gradient) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={className}
        aria-label="Tenxo"
      >
        <defs>
          <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5E6AD2" />
            <stop offset="100%" stopColor="#E5FF52" />
          </linearGradient>
        </defs>
        <line x1="6" y1="7" x2="26" y2="7" stroke={`url(#lg-${id})`} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="7" x2="16" y2="28" stroke={`url(#lg-${id})`} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="6" cy="7" r="2.5" fill={`url(#lg-${id})`} opacity={0.4} />
        <circle cx="16" cy="7" r="2.5" fill={`url(#lg-${id})`} />
        <circle cx="26" cy="7" r="2.5" fill={`url(#lg-${id})`} opacity={0.4} />
        <circle cx="16" cy="18" r="2.5" fill={`url(#lg-${id})`} />
        <circle cx="16" cy="28" r="2.5" fill={`url(#lg-${id})`} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Tenxo"
    >
      <line x1="6" y1="7" x2="26" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="7" x2="16" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="7" r="2.5" fill="currentColor" opacity={0.4} />
      <circle cx="16" cy="7" r="2.5" fill="currentColor" />
      <circle cx="26" cy="7" r="2.5" fill="currentColor" opacity={0.4} />
      <circle cx="16" cy="18" r="2.5" fill="currentColor" />
      <circle cx="16" cy="28" r="2.5" fill="currentColor" />
    </svg>
  );
}
