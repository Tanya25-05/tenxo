"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  Copy,
  Cpu,
  CreditCard,
  Gauge,
  KeyRound,
  Layers3,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useNatsSocket, type JobUpdate } from "@/components/hooks/useNatsSocket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Node {
  node_id: string;
  status: string;
  ttl_seconds: number;
  gpu_model?: string;
  gpu_vram_mb?: number;
  tee_attested: boolean;
  tee_last_attested?: string;
}

interface Pod {
  job_id: string;
  status: string;
  gpu_model?: string;
  result_url?: string;
  updated_at?: string;
}

interface Metrics {
  nodes_total: number;
  nodes_available: number;
  total_vram_mb: number;
  jobs_total: number;
  jobs_active: number;
  gpu_inventory: Array<{ sku: string; total: number; available: number; vram_mb: number }>;
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
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkNodes, setNetworkNodes] = useState<Node[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedGpuId, setSelectedGpuId] = useState(gpuTiers[0].id);
  const [meterRunning, setMeterRunning] = useState(false);
  const [meterSeconds, setMeterSeconds] = useState(0);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copyIdx, setCopyIdx] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetchNetworkStatus(session.access_token);
    fetchPods(session.access_token);
    fetchAPIKeys(session.access_token);
    fetchMetrics(session.access_token);
    const timer = setInterval(() => {
      fetchNetworkStatus(session.access_token);
      fetchPods(session.access_token);
      fetchMetrics(session.access_token);
    }, 10000);
    return () => clearInterval(timer);
  }, [session?.access_token]);

  const handleJobUpdate = useCallback((update: JobUpdate) => {
    setPods((current) =>
      current.map((job) =>
        job.job_id === update.job_id
          ? { ...job, status: update.status, result_url: update.result_url || job.result_url }
          : job,
      ),
    );
  }, []);

  const { status: socketStatus } = useNatsSocket({
    token: session?.access_token,
    onJobUpdate: handleJobUpdate,
  });

  const fetchPods = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPods(data.jobs || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchAPIKeys = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setApiKeys(data.keys || []);
      if (data._new_key) setNewKey(data._new_key);
    } catch {
      // silent
    } finally {
      setApiKeysLoading(false);
    }
  };

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

  const fetchMetrics = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMetrics(await res.json());
    } catch {
      // silent
    }
  };

  const estimatedHourly = useMemo(
    () => ((metrics?.nodes_available ?? networkNodes.length) * 0.15).toFixed(2),
    [metrics?.nodes_available, networkNodes.length],
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
      <div className="grid min-h-screen place-items-center text-sm   text-text-tertiary">
        Verifying Tenxo session...
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Topbar */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-widest   text-text-tertiary uppercase">
            Developer Console
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {activeTab === "billing" ? "API, Billing & Access" : "GPU Compute Pods"}
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-text-secondary">
          <span className="size-1.5 rounded-full bg-emerald-500/70" />
          {loadingNetwork ? "Scanning grid" : `${metrics?.nodes_available ?? networkNodes.length} GPUs idle`}
        </div>
      </div>

      {/* Tab nav */}
      <div className="mb-6 flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
        <button
          onClick={() => setActiveTab("pods")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "pods" ? "bg-white/10 text-white" : "  text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Compute
        </button>
        <button
          onClick={() => setActiveTab("billing")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "billing" ? "bg-white/10 text-white" : "  text-text-tertiary hover:text-text-secondary"
          }`}
        >
          API & Billing
        </button>
      </div>

      {activeTab === "pods" ? (
        <div className="space-y-6">
          {/* Metrics */}
          <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard icon={Cpu} label="Available GPUs" value={loadingNetwork ? "..." : metrics?.nodes_available ?? networkNodes.length} helper={`${((metrics?.total_vram_mb ?? 0) / 1024).toFixed(0)} GB aggregate VRAM online.`} />
            <MetricCard icon={Layers3} label="Active Jobs" value={loading ? "..." : metrics?.jobs_active ?? pods.length} helper={`Socket ${socketStatus}; ${metrics?.jobs_total ?? pods.length} jobs tracked.`} />
            <MetricCard icon={Sparkles} label="Grid Cost / Hr" value={`$${estimatedHourly}`} helper="Baseline marketplace estimate." />
          </section>

          {/* Meter section */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c0c0d]">
            <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-widest   text-text-tertiary uppercase">
                  Pay as you go
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Choose compute and meter usage
                </h2>
                <p className="mt-1 text-xs   text-text-tertiary">
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
              <div className="border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-2">
                  {gpuTiers.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedGpuId(tier.id)}
                      className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors ${
                        selectedGpuId === tier.id
                          ? "border-white/20 bg-white/[0.06]"
                          : "border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]"
                      }`}
                    >
                      <span>
                        <p className="text-sm font-medium text-white">{tier.name}</p>
                        <p className="mt-0.5 text-xs   text-text-tertiary">
                          {tier.memory} VRAM &middot; {tier.useCase}
                        </p>
                      </span>
                      <span className="text-sm font-medium text-text-secondary">
                        ${tier.price.toFixed(2)}/hr
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-between p-5">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest   text-text-tertiary uppercase">
                    Current meter
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{selectedGpu.name}</h3>
                </div>
                <div className="mt-6 flex items-center gap-2 font-mono text-2xl font-semibold tracking-tight text-white">
                  <Clock3 className="size-5   text-text-tertiary" />
                  <span>{meterTime}</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-4">
                  <span className="text-xs   text-text-tertiary">Estimated charge</span>
                  <strong className="text-lg font-semibold text-white">${meteredCost}</strong>
                </div>
                <div className="mt-4 flex items-start gap-2 text-[11px]   text-text-tertiary">
                  <Gauge className="mt-0.5 size-3.5 shrink-0" />
                  <span>Charges scale with active runtime. Production billing should be backed by server-side pod events.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Pods section */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c0c0d]">
            <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-widest   text-text-tertiary uppercase">
                  Deploy
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Compute pods</h2>
                <p className="mt-1 text-xs   text-text-tertiary">
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
              <div className="py-10 text-center text-xs   text-text-tertiary">Loading pods...</div>
            ) : pods.length === 0 ? (
              <div className="grid place-items-center px-6 py-14 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <Cpu className="size-5 text-text-secondary" />
                </div>
                <h3 className="text-base font-semibold text-white">No active pods yet</h3>
                <p className="mt-2 max-w-md text-xs   text-text-tertiary">
                  Start with a small inference pod, then scale into idle GPUs as demand grows.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {pods.map((pod) => (
                  <div key={pod.job_id} className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-emerald-500/70" />
                        <p className="text-sm font-medium text-white">{pod.gpu_model || "Tenxo job"}</p>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs   text-text-tertiary">{pod.job_id} · {pod.status}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Play className="size-3.5" />
                      Details
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Marketplace */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c0c0d]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest   text-text-tertiary uppercase">
                  Marketplace
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Idle GPU supply</h2>
              </div>
              <div className="hidden items-center gap-2 text-xs   text-text-tertiary sm:flex">
                <ShieldCheck className="size-4 text-text-secondary" />
                Authenticated providers
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-white/[0.08]">
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider   text-text-tertiary">Node ID</th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider   text-text-tertiary">Status</th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider   text-text-tertiary">TEE</th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider   text-text-tertiary">Price / Hr</th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider   text-text-tertiary">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {networkNodes.length === 0 && !loadingNetwork ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-xs   text-text-tertiary">
                        No idle nodes currently available on the grid.
                      </td>
                    </tr>
                  ) : (
                    networkNodes.map((node) => (
                      <tr key={node.node_id} className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]">
                        <td className="px-6 py-3 font-mono text-xs text-text-secondary">
                          {node.node_id.substring(0, 12)}...
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                            <span className="size-1.5 rounded-full bg-emerald-500/70" />
                            {node.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {node.tee_attested ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-xs text-text-secondary">$0.15</td>
                        <td className="px-6 py-3 text-xs   text-text-tertiary">Ready for match</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {metrics?.gpu_inventory?.length ? (
              <div className="border-t border-white/[0.08] px-6 py-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">GPU SKU Inventory</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {metrics.gpu_inventory.map((sku) => (
                    <div key={sku.sku} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <p className="text-sm font-medium text-white">{sku.sku}</p>
                      <p className="mt-1 text-xs text-text-tertiary">{sku.available}/{sku.total} available · {(sku.vram_mb / 1024).toFixed(0)} GB VRAM</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        /* Billing tab */
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest   text-text-tertiary uppercase">
                  Authentication
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Bearer token</h2>
                <p className="mt-2 text-xs   text-text-tertiary">
                  Use this Supabase JWT with the CLI and matchmaker-protected API routes.
                </p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <KeyRound className="size-4 text-text-secondary" />
              </div>
            </div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest   text-text-tertiary">
              API Bearer Token
            </label>
            <input
              type="text"
              readOnly
              value={session.access_token}
              className="mb-4 w-full rounded-lg border border-white/[0.08] bg-black/40 px-4 py-2.5 font-mono text-xs text-text-secondary outline-none focus:border-white/20"
            />
            <Button variant="primary" size="sm" onClick={handleCopyToken}>
              <CreditCard className="size-3.5" />
              {copied ? "Copied" : "Copy token"}
            </Button>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest   text-text-tertiary uppercase">
                  API Keys
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">Manage access keys</h2>
                <p className="mt-2 text-xs   text-text-tertiary">
                  API keys for CLI and automation. Keys are auto-generated on first visit and use <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">txn_</code> prefix.
                </p>
              </div>
            </div>

            {newKey && (
              <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-medium text-emerald-400">New API key created — copy it now</p>
                <p className="mt-1 text-[11px] text-text-tertiary">You won't be able to see it again once dismissed.</p>
                <div className="relative mt-3">
                  <input
                    type="text"
                    readOnly
                    value={newKey}
                    className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-4 py-2.5 font-mono text-xs text-text-secondary outline-none pr-20"
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(newKey); setCopyIdx('_new'); setTimeout(() => setCopyIdx(null), 1600); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                  >
                    {copyIdx === '_new' ? "Copied!" : "Copy"}
                  </button>
                </div>
                <button onClick={() => setNewKey(null)} className="mt-3 text-[11px] font-medium text-text-tertiary hover:text-text-secondary">
                  Dismiss
                </button>
              </div>
            )}

            {/* Key list */}
            <APIKeyList token={session.access_token} />
          </section>
        </div>
      )}
    </div>
  );
}

function APIKeyList({ token }: { token: string }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const revokeKey = async (id: string) => {
    if (!confirm("Revoke this API key? Existing integrations using it will stop working.")) return;
    try {
      await fetch(`${API_URL}/api/keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchKeys();
    } catch {
      // silent
    }
  };

  const copyKeyId = (id: string) => {
    navigator.clipboard.writeText(id.substring(0, 12) + "...");
  };

  if (loading) {
    return <div className="py-8 text-center text-xs text-text-tertiary">Loading keys...</div>;
  }

  if (keys.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-white/[0.08] py-8 text-center">
        <KeyRound className="mx-auto size-5 text-text-tertiary" />
        <p className="mt-2 text-xs text-text-tertiary">No API keys yet. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      {keys.map((key) => (
        <div key={key.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{key.name}</span>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary uppercase">{key.role}</span>
              {!key.is_active && (
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Revoked</span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] text-text-tertiary">
              <span title={key.id}>{key.id.substring(0, 16)}...</span>
              <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
              {key.last_used_at && <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {key.is_active && (
              <button onClick={() => revokeKey(key.id)} className="rounded-md p-1.5 text-text-tertiary hover:text-red-400 hover:bg-red-500/10" title="Revoke key">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
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
    <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em]   text-text-tertiary">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <Icon className="size-4 text-text-secondary" />
        </div>
      </div>
      {helper && <p className="mt-3 text-[11px]   text-text-tertiary">{helper}</p>}
    </div>
  );
}
