"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  action: () => void;
}

interface CommandPaletteProps {
  items: CommandItem[];
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ items, open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q),
    );
  }, [query, items]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] rounded-xl border border-white/[0.08] bg-surface shadow-2xl">
        <div className="flex items-center border-b border-white/[0.08] px-4">
          <svg className="size-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent px-3 py-3.5 text-[14px] text-white placeholder-zinc-500 outline-none"
          />
          <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-500 sm:inline-block">
            ESC
          </kbd>
        </div>
        {filtered.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto p-2">
            {filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  i === selectedIndex
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                )}
              >
                <div className="flex-1">
                  <p className="text-[13px] font-medium">{item.label}</p>
                  {item.description && (
                    <p className="mt-0.5 text-[11px] text-zinc-500">{item.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-[13px] text-zinc-500">
            No results for &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

export function useCommandPaletteItems(): CommandItem[] {
  const router = useRouter();
  return useMemo(
    () => [
      { id: "marketplace", label: "Go to Marketplace", description: "Browse and deploy GPU instances", action: () => router.push("/marketplace") },
      { id: "billing", label: "Go to Billing", description: "View usage and manage payments", action: () => router.push("/billing") },
      { id: "developer", label: "Go to Developer Console", description: "Manage compute pods and API keys", action: () => router.push("/developer") },
      { id: "provider", label: "Go to Provider Console", description: "Manage your hardware fleet", action: () => router.push("/provider") },
      { id: "pricing", label: "View Pricing", description: "See GPU instance pricing", action: () => router.push("/pricing") },
      { id: "docs", label: "View Documentation", description: "API reference and guides", action: () => router.push("/docs") },
    ],
    [router],
  );
}
