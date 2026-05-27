"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  Cpu,
  CreditCard,
  Gauge,
  KeyRound,
  Layers3,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Node {
  node_id: string;
  status: string;
  ttl_seconds: number;
}

interface Pod {
  id: string;
  name: string;
}

const gpuTiers = [
  { id: "rtx-4090", name: "RTX 4090", memory: "24 GB", useCase: "Fine-tuning, inference", price: 0.15 },
  { id: "a5000", name: "RTX A5000", memory: "24 GB", useCase: "Stable training runs", price: 0.22 },
  { id: "a100", name: "A100", memory: "40 GB", useCase: "Large model training", price: 0.75 },
];

export default function DeveloperDashboard() {
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState("pods");
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkNodes, setNetworkNodes] = useState<Node[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedGpuId, setSelectedGpuId] = useState(gpuTiers[0].id);
  const [meterRunning, setMeterRunning] = useState(false);
  const [meterSeconds, setMeterSeconds] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetchNetworkStatus(session.access_token);
  }, [session?.access_token]);

  useEffect(() => {
    async function fetchPods() {
      try {
        const res = await fetch(`${API_URL}/pods`);
        if (res.ok) setPods(await res.json());
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchPods();
  }, []);

  useEffect(() => {
    if (!meterRunning) return;
    const timer = setInterval(() => setMeterSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [meterRunning]);

  const fetchNetworkStatus = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setNetworkNodes(data.nodes || []);
    } catch {
      // silent
    } finally {
      setLoadingNetwork(false);
    }
  };

  const estimatedHourly = useMemo(
    () => (networkNodes.length * 0.15).toFixed(2),
    [networkNodes.length],
  );
  const selectedGpu = useMemo(
    () => gpuTiers.find((t) => t.id === selectedGpuId) || gpuTiers[0],
    [selectedGpuId],
  );
  const meteredCost = useMemo(
    () => ((meterSeconds / 3600) * selectedGpu.price).toFixed(4),
    [meterSeconds, selectedGpu.price],
  );
  const meterTime = useMemo(() => {
    const h = Math.floor(meterSeconds / 3600);
    const m = Math.floor((meterSeconds % 3600) / 60);
    const s = meterSeconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }, [meterSeconds]);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(session?.access_token || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (checkingAuth || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-gray-500">
        Verifying Tenxo session...
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Topbar */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
            Developer Console
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {activeTab === "billing" ? "API, Billing & Access" : "GPU Compute Pods"}
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-gray-400">
          <span className="size-1.5 rounded-full bg-emerald-500/70" />
          {loadingNetwork ? "Scanning grid" : `${networkNodes.length} GPUs idle`}
        </div>
      </div>

      {/* Tab nav */}
      <div className="mb-6 flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
        <button
          onClick={() => setActiveTab("pods")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "pods" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Compute
        </button>
        <button
          onClick={() => setActiveTab("billing")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "billing" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          API & Billing
        </button>
      </div>

      {activeTab === "pods" ? (
        <div className="space-y-6">
          {/* Metrics */}
          <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard icon={Cpu} label="Available GPUs" value={loadingNetwork ? "..." : networkNodes.length} helper="Live nodes reported by the matchmaker." />
            <MetricCard icon={Layers3} label="Active Pods" value={loading ? "..." : pods.length} helper="Current developer workloads from /pods." />
            <MetricCard icon={Sparkles} label="Grid Cost / Hr" value={`$${estimatedHourly}`} helper="Baseline marketplace estimate." />
          </section>

          {/* Meter section */}
          <section className="rounded-xl border border-white/[0.06] bg-[#0c0c0d]">
            <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                  Pay as you go
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Choose compute and meter usage
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Select the GPU class for a workload. Runtime is tracked by the second and priced hourly.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={meterRunning ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => setMeterRunning((r) => !r)}
                >
                  <Clock3 className="size-3.5" />
                  {meterRunning ? "Pause meter" : "Start meter"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setMeterRunning(false); setMeterSeconds(0); }}
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="border-b border-white/[0.06] p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-2">
                  {gpuTiers.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedGpuId(tier.id)}
                      className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors ${
                        selectedGpuId === tier.id
                          ? "border-white/20 bg-white/[0.06]"
                          : "border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03]"
                      }`}
                    >
                      <span>
                        <p className="text-sm font-medium text-white">{tier.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {tier.memory} VRAM &middot; {tier.useCase}
                        </p>
                      </span>
                      <span className="text-sm font-medium text-gray-300">
                        ${tier.price.toFixed(2)}/hr
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-between p-5">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                    Current meter
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{selectedGpu.name}</h3>
                </div>
                <div className="mt-6 flex items-center gap-2 font-mono text-2xl font-semibold tracking-tight text-white">
                  <Clock3 className="size-5 text-gray-500" />
                  <span>{meterTime}</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
                  <span className="text-xs text-gray-500">Estimated charge</span>
                  <strong className="text-lg font-semibold text-white">${meteredCost}</strong>
                </div>
                <div className="mt-4 flex items-start gap-2 text-[11px] text-gray-500">
                  <Gauge className="mt-0.5 size-3.5 shrink-0" />
                  <span>Charges scale with active runtime. Production billing should be backed by server-side pod events.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Pods section */}
          <section className="rounded-xl border border-white/[0.06] bg-[#0c0c0d]">
            <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                  Deploy
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Compute pods</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Launch decentralized containers against the live GPU supply.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm">
                  <ArrowUpRight className="size-3.5" />
                  CLI deploy
                </Button>
                <Button variant="primary" size="sm">
                  <Plus className="size-3.5" />
                  Deploy pod
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-center text-xs text-gray-500">Loading pods...</div>
            ) : pods.length === 0 ? (
              <div className="grid place-items-center px-6 py-14 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                  <Cpu className="size-5 text-gray-300" />
                </div>
                <h3 className="text-base font-semibold text-white">No active pods yet</h3>
                <p className="mt-2 max-w-md text-xs text-gray-500">
                  Start with a small inference pod, then scale into idle GPUs as demand grows.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {pods.map((pod) => (
                  <div key={pod.id} className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-emerald-500/70" />
                        <p className="text-sm font-medium text-white">{pod.name}</p>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-gray-500">{pod.id}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Play className="size-3.5" />
                      Resume
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Marketplace */}
          <section className="rounded-xl border border-white/[0.06] bg-[#0c0c0d]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                  Marketplace
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Idle GPU supply</h2>
              </div>
              <div className="hidden items-center gap-2 text-xs text-gray-500 sm:flex">
                <ShieldCheck className="size-4 text-gray-400" />
                Authenticated providers
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600">Node ID</th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600">Price / Hr</th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {networkNodes.length === 0 && !loadingNetwork ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-xs text-gray-500">
                        No idle nodes currently available on the grid.
                      </td>
                    </tr>
                  ) : (
                    networkNodes.map((node) => (
                      <tr key={node.node_id} className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]">
                        <td className="px-6 py-3 font-mono text-xs text-gray-300">
                          {node.node_id.substring(0, 12)}...
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                            <span className="size-1.5 rounded-full bg-emerald-500/70" />
                            {node.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-gray-300">$0.15</td>
                        <td className="px-6 py-3 text-xs text-gray-500">Ready for match</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        /* Billing tab */
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-xl border border-white/[0.06] bg-[#0c0c0d] p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                  Authentication
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Bearer token</h2>
                <p className="mt-2 text-xs text-gray-500">
                  Use this Supabase JWT with the CLI and matchmaker-protected API routes.
                </p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                <KeyRound className="size-4 text-gray-300" />
              </div>
            </div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              API Bearer Token
            </label>
            <input
              type="text"
              readOnly
              value={session.access_token}
              className="mb-4 w-full rounded-lg border border-white/[0.06] bg-black/40 px-4 py-2.5 font-mono text-xs text-gray-400 outline-none focus:border-white/20"
            />
            <Button variant="primary" size="sm" onClick={handleCopyToken}>
              <CreditCard className="size-3.5" />
              {copied ? "Copied" : "Copy token"}
            </Button>
          </section>

          <section className="rounded-xl border border-white/[0.06] bg-[#0c0c0d] p-6">
            <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
              Controls
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">MVP readiness</h2>
            <div className="mt-5 space-y-3">
              {[
                ["Supabase auth", "Active session gated console"],
                ["Go matchmaker", "Live nodes and pods endpoints wired"],
                ["Secure workers", "Token-based API access ready"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-medium text-white">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
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
    <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0d] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-600">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
          <Icon className="size-4 text-gray-300" />
        </div>
      </div>
      {helper && <p className="mt-3 text-[11px] text-gray-500">{helper}</p>}
    </div>
  );
}
