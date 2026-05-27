"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle,
  Copy,
  HardDrive,
  PlugZap,
  Server,
  ShieldCheck,
  Timer,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Node {
  node_id: string;
  status: string;
  ttl_seconds: number;
}

export default function ProviderDashboard() {
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [myNodes, setMyNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetchMyNodes(session.access_token);
  }, [session?.access_token]);

  const fetchMyNodes = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/my-nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyNodes(data.nodes || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const avgTtl = useMemo(() => {
    if (!myNodes.length) return 0;
    const total = myNodes.reduce((sum, n) => sum + Number(n.ttl_seconds || 0), 0);
    return Math.round(total / myNodes.length);
  }, [myNodes]);

  const installScript = `curl -sSL https://tenxo.com/install.sh | bash -s -- --token ${session?.access_token?.substring(0, 20)}...`;

  const handleCopy = () => {
    navigator.clipboard.writeText(installScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (checkingAuth || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-text-tertiary">
        Verifying Tenxo session...
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Topbar */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-text-tertiary uppercase">Provider Console</p>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">Hardware Fleet</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-[11px] font-medium text-text-tertiary">
          <span className="size-1.5 rounded-full bg-emerald-500/70" />
          {loading ? "Syncing fleet" : `${myNodes.length} workers online`}
        </div>
      </div>

      {/* Metrics */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Server} label="Active GPUs" value={loading ? "..." : myNodes.length} helper="Worker agents authenticated to your account." />
        <MetricCard icon={Wallet} label="Daily Earnings" value="$0.00" helper="Projected until live billing lands." />
        <MetricCard icon={Timer} label="Heartbeat TTL" value={`${avgTtl}s`} helper="Average heartbeat expiry across workers." />
      </section>

      {/* Main grid */}
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Onboarding card */}
        <Card>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-text-tertiary uppercase">Onboarding</p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">Connect a worker</h2>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                Run the agent on an Ubuntu machine with NVIDIA drivers to expose idle GPU capacity to the Tenxo grid.
              </p>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
              <PlugZap className="size-4 text-text-secondary" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-black/40 p-4">
            <code className="break-all font-mono text-xs text-text-tertiary">{installScript}</code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-white/[0.05] hover:text-text-secondary"
              title="Copy install command"
            >
              {copied ? <CheckCircle className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
              <ShieldCheck className="mb-2 size-4 text-text-secondary" />
              <p className="text-sm font-medium text-text-primary">Token scoped</p>
              <p className="mt-1 text-[11px] text-text-tertiary">Provider ownership is bound through Supabase auth.</p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
              <HardDrive className="mb-2 size-4 text-text-secondary" />
              <p className="text-sm font-medium text-text-primary">Lightweight agent</p>
              <p className="mt-1 text-[11px] text-text-tertiary">Heartbeat data streams into the matchmaker API.</p>
            </div>
          </div>
        </Card>

        {/* Fleet table */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-text-tertiary uppercase">Fleet</p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">Registered hardware</h2>
            </div>
            <Activity className="size-5 text-text-tertiary" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Node ID</th>
                  <th className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Status</th>
                  <th className="pb-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-text-tertiary">
                      Loading fleet data...
                    </td>
                  </tr>
                ) : myNodes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-text-tertiary">
                      No nodes connected yet. Run the install command to add your first GPU.
                    </td>
                  </tr>
                ) : (
                  myNodes.map((node) => (
                    <tr key={node.node_id} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                      <td className="py-3 pr-4 font-mono text-xs text-text-secondary">{node.node_id}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
                          <span className="size-1.5 rounded-full bg-emerald-500/70" />
                          {node.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-text-tertiary">{node.ttl_seconds}s remaining</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: any;
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.01] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{value}</div>
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <Icon className="size-4 text-text-secondary" />
        </div>
      </div>
      {helper && <p className="mt-3 text-[11px] text-text-tertiary">{helper}</p>}
    </div>
  );
}
