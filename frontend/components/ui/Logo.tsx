import { useId } from "react";

interface LogoProps {
  size?: number;
  className?: string;
  gradient?: boolean;
}

export function Logo({ size = 28, className, gradient }: LogoProps) {
  const id = useId();

  const lines = (stroke: string) => (
    <>
      <line x1="5" y1="6" x2="27" y2="6" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="6" x2="16" y2="27" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </>
  );

  const circles = (fill: string) => (
    <>
      <circle cx="5" cy="6" r="3" fill={fill} />
      <circle cx="16" cy="6" r="3" fill={fill} />
      <circle cx="27" cy="6" r="3" fill={fill} />
      <circle cx="16" cy="17" r="3" fill={fill} />
      <circle cx="16" cy="27" r="3" fill={fill} />
    </>
  );

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
        {lines(`url(#lg-${id})`)}
        {circles(`url(#lg-${id})`)}
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
      {lines("currentColor")}
      {circles("currentColor")}
    </svg>
  );
}
