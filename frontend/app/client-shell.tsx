"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CommandPalette, useCommandPaletteItems } from "@/components/ui/CommandPalette";
import { ToastProvider } from "@/components/ui/Toast";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = usePathname();
  const appRoutes = ["/marketplace", "/developer", "/billing", "/provider", "/user"];
  const isAppRoute = appRoutes.some((r) => pathname?.startsWith(r));

  const toggleCmd = useCallback(() => setCmdOpen((v) => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCmd();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleCmd]);

  const cmdItems = useCommandPaletteItems();

  const handleClose = useCallback(() => setCmdOpen(false), []);

  return (
    <ToastProvider>
      {children}
      {isAppRoute && (
        <CommandPalette items={cmdItems} open={cmdOpen} onClose={handleClose} />
      )}
    </ToastProvider>
  );
}
