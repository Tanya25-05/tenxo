"use client";

import { useEffect, useRef, useState } from "react";

interface Line {
  text: string;
  type: "command" | "output" | "success" | "info";
}

const lines: Line[] = [
  { text: "$ tenxo login", type: "command" },
  { text: "Authenticated successfully.", type: "success" },
  { text: "$ tenxo deploy --gpu rtx-4090 --image pytorch/pytorch:latest", type: "command" },
  { text: "Searching decentralized grid for RTX 4090...", type: "info" },
  { text: "Match found! Provider node connected.", type: "success" },
  { text: "Pod deployed in 4.2s. Access at: 10.0.0.42:8080", type: "success" },
];

export function FloatingTerminal() {
  const [displayedLines, setDisplayedLines] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [cursor, setCursor] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(t);
  }, []);

  // Line stagger + typewriter
  useEffect(() => {
    if (displayedLines >= lines.length) return;

    const currentLine = lines[displayedLines];
    const lineLen = currentLine.text.length;

    // If current line is fully typed, move to next after a pause
    if (typedChars >= lineLen) {
      const pause = setTimeout(() => {
        setDisplayedLines((p) => p + 1);
        setTypedChars(0);
      }, 400);
      return () => clearTimeout(pause);
    }

    // Type next character
    const speed = currentLine.type === "command" ? 18 : 12;
    const t = setTimeout(() => {
      setTypedChars((c) => c + 1);
    }, speed);
    return () => clearTimeout(t);
  }, [displayedLines, typedChars]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, typedChars]);

  return (
    <div className="w-full rounded-xl border border-white/[0.06] bg-[#0c0c0d] shadow-2xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
        </div>
        <span className="ml-2 text-[11px] font-medium tracking-wide text-white/30">
          terminal — tenxo CLI
        </span>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        className="overflow-auto p-4 font-mono text-[13px] leading-relaxed"
        style={{ minHeight: 280, maxHeight: 360 }}
      >
        {lines.slice(0, displayedLines).map((line, i) => (
          <TerminalLine key={i} line={line} fullyTyped />
        ))}

        {displayedLines < lines.length && (
          <TerminalLine
            line={lines[displayedLines]}
            typedChars={typedChars}
            cursor={cursor}
          />
        )}

        {displayedLines >= lines.length && (
          <span
            className={`inline-block w-2 h-4 bg-white/70 ml-0.5 ${cursor ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </div>
    </div>
  );
}

function TerminalLine({
  line,
  fullyTyped,
  typedChars,
  cursor,
}: {
  line: Line;
  fullyTyped?: boolean;
  typedChars?: number;
  cursor?: boolean;
}) {
  const text = fullyTyped ? line.text : line.text.slice(0, typedChars);
  const showCursor = fullyTyped ? false : cursor;

  const colorMap: Record<Line["type"], string> = {
    command: "text-white/90",
    output: "text-white/60",
    success: "text-emerald-400",
    info: "text-amber-400/80",
  };

  return (
    <div className={colorMap[line.type]}>
      <span>{text}</span>
      {showCursor && (
        <span className="inline-block w-2 h-4 bg-white/70 ml-0.5 animate-pulse" />
      )}
    </div>
  );
}
