"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  Container,
  CreditCard,
  Cpu,
  LogOut,
  Network,
  Search,
  Server,
  ShoppingCart,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Marketplace", icon: ShoppingCart, path: "/marketplace" },
  { name: "Compute", icon: Cpu, path: "/developer" },
  { name: "Billing", icon: CreditCard, path: "/billing" },
  { name: "Hardware", icon: Server, path: "/provider" },
  { name: "Profile", icon: Activity, path: "/user" },
  { name: "Docs", icon: BookOpen, path: "/docs" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
      if (!session) router.replace("/");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (!sess) router.replace("/");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && navigator.platform.includes("Mac"));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/");
  };

  if (checking || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-text-secondary">
        Verifying Tenxo session...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-white/[0.08] bg-surface/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-6">
          <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05]">
            <Network className="size-4 text-zinc-300" />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-text-primary">
              TENXO
            </div>
            <div className="text-[10px] tracking-[0.15em] text-text-tertiary">
              Compute Grid
            </div>
          </div>
        </div>

        <div className="mx-3 mb-4 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <Activity className="size-3.5 text-emerald-400" />
            Secure relay active
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-3/4 rounded-full bg-white/30" />
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.name}
                href={item.path}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                  selected
                    ? "border border-white/[0.08] bg-white/[0.06] text-text-primary"
                    : "text-text-tertiary hover:bg-white/[0.03] hover:text-text-primary",
                )}
              >
                <Icon className="size-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.08] px-3 py-4">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-text-tertiary">
            <Search className="size-3.5" />
            Press {isMac ? "⌘K" : "Ctrl+K"}
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-text-tertiary transition-colors hover:bg-white/[0.03] hover:text-text-primary"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
