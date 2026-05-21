import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { Server, Cpu, CreditCard, Key, LogOut, Shield } from "lucide-react";

export default function DashboardLayout({ children, role }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/");
      setSession(data.session);
    });
  }, [router]);

  if (!mounted || !session) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-emerald-500">Connecting to Grid...</div>;

  const navItems = role === 'developer' ? [
    { name: 'Active Jobs', icon: Cpu, path: '/app/developer' },
    { name: 'API & Security', icon: Key, path: '/app/developer/keys' },
    { name: 'Billing', icon: CreditCard, path: '/app/developer/billing' },
  ] : [
    { name: 'My Nodes', icon: Server, path: '/app/provider' },
    { name: 'Earnings', icon: CreditCard, path: '/app/provider/earnings' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--app-bg)] subtle-grid">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-y-0 border-l-0 flex flex-col z-20">
        <div className="p-6 flex items-center gap-3">
          <Server className="text-[var(--accent)]" />
          <span className="font-bold text-xl tracking-tight">GPU<span className="text-[var(--accent)]">Grid</span></span>
        </div>
        
        {/* USP Badge */}
        <div className="mx-4 mb-6 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
          <Shield size={14} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Zero-Trust Encrypted</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
             <button key={item.name} onClick={() => router.push(item.path)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${router.pathname === item.path ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
               <item.icon size={18} /> {item.name}
             </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[var(--border-color)]">
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white transition-colors">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10 p-8">
        {children}
      </main>
    </div>
  );
}