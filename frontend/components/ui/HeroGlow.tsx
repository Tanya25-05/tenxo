"use client";

import { useEffect, useRef } from "react";

export function HeroGlow({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glow1Ref = useRef<HTMLDivElement>(null);
  const glow2Ref = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    const g1 = glow1Ref.current;
    const g2 = glow2Ref.current;
    if (!el || !g1 || !g2) return;

    const s = { mx: -500, my: -500, x1: -500, y1: -500, x2: -500, y2: -500 };

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      s.mx = e.clientX - rect.left;
      s.my = e.clientY - rect.top;
      if (!visibleRef.current) {
        visibleRef.current = true;
        g1.style.opacity = "1";
        g2.style.opacity = "1";
      }
    };

    const onLeave = () => {
      visibleRef.current = false;
      g1.style.opacity = "0";
      g2.style.opacity = "0";
    };

    let raf: number;
    const tick = () => {
      s.x1 += (s.mx - s.x1) * 0.05;
      s.y1 += (s.my - s.y1) * 0.05;
      s.x2 += (s.mx - s.x2) * 0.025;
      s.y2 += (s.my - s.y2) * 0.025;
      g1.style.transform = `translate(${s.x1 - 250}px, ${s.y1 - 250}px)`;
      g2.style.transform = `translate(${s.x2 - 175}px, ${s.y2 - 175}px)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        ref={glow1Ref}
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-700"
        aria-hidden
        style={{ mixBlendMode: "screen" }}
      >
        <div
          className="absolute left-0 top-0 size-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(94,106,210,0.5) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
      </div>
      <div
        ref={glow2Ref}
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-700"
        aria-hidden
        style={{ mixBlendMode: "screen" }}
      >
        <div
          className="absolute left-0 top-0 size-[350px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(229,255,82,0.25) 0%, transparent 50%)",
            filter: "blur(60px)",
          }}
        />
      </div>
      <div className="relative z-0">{children}</div>
    </div>
  );
}
