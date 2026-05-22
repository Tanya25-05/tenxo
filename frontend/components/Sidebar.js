import {
  Activity,
  Cpu,
  CreditCard,
  KeyRound,
  LogOut,
  Network,
  Server,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

const navItems = [
  { name: "Compute", icon: Cpu, path: "/app/developer", scope: "developer" },
  {
    name: "API & Billing",
    icon: CreditCard,
    path: "/app/developer",
    tab: "billing",
    scope: "developer",
  },
  { name: "Hardware", icon: Server, path: "/app/provider", scope: "provider" },
];

export default function Sidebar({
  active = "Compute",
  role = "developer",
  onSelect,
}) {
  const router = useRouter();
  const visibleItems = navItems.filter((item) => item.scope === role);

  const handleNavigate = (item) => {
    if (item.tab && onSelect) {
      onSelect(item.tab);
      return;
    }
    router.push(item.path);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/");
  };

  return (
    <aside className="tenxo-sidebar">
      <div className="tenxo-brand">
        <div className="tenxo-brand-mark">
          <Network size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-[0.24em] text-white">
            TENXO
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
            Compute Grid
          </div>
        </div>
      </div>

      <div className="tenxo-health">
        <div className="flex items-center gap-2 text-[var(--text-main)]">
          <Activity size={14} className="text-[var(--accent-tenxo)]" />
          <span className="text-xs font-medium">Secure relay active</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-3/4 rounded-full bg-white/40" />
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visibleItems.map((item) => {
          const selected = active === item.name;
          return (
            <button
              key={item.name}
              onClick={() => handleNavigate(item)}
              className={`tenxo-nav-item ${selected ? "tenxo-nav-item-active" : ""}`}
            >
              <item.icon size={17} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div className="tenxo-mini-card mb-3">
          <KeyRound size={15} className="text-[var(--text-muted)]" />
          <span>Zero-trust worker auth</span>
        </div>
        <button
          onClick={handleSignOut}
          className="tenxo-nav-item text-[var(--text-soft)]"
        >
          <LogOut size={17} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
