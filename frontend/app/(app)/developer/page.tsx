"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
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
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useNatsSocket, type JobUpdate } from "@/components/hooks/useNatsSocket";
import { API_URL } from "@/lib/api";
import { formatCents, formatHourlyRate, GPU_SKU_CATALOG, type GpuSku } from "@/lib/gpuSkus";

interface Node {
  node_id: string;
  status: string;
  ttl_seconds: number;
  gpu_model?: string;
  gpu_vram_mb?: number;
  tee_attested: boolean;
  tee_last_attested?: string;
  price_per_hour?: number;
  hourly_rate_cents?: number;
}

interface Pod {
  job_id: string;
  status: string;
  gpu_model?: string;
  result_url?: string;
  updated_at?: string;
  node_id?: string;
  hourly_rate_cents?: number;
  estimated_cost_cents?: number;
  elapsed_seconds?: number;
  error?: string;
}

interface JobDetails extends Pod {
  owner?: string;
  upload_url?: string;
  result_upload_url?: string;
  receipt_url?: string;
  enc_key_b64?: string;
  created_at?: string;
}

interface Metrics {
  nodes_total: number;
  nodes_available: number;
  total_vram_mb: number;
  jobs_total: number;
  jobs_active: number;
  gpu_inventory: Array<{
    sku: string;
    total: number;
    available: number;
    vram_mb: number;
    price_per_hour?: number;
    hourly_rate_cents?: number;
  }>;
}

const JOBS_PER_PAGE = 10;

export default function DeveloperDashboard() {
  const { isLoaded, getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pods");
  const [pods, setPods] = useState<Pod[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkNodes, setNetworkNodes] = useState<Node[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(true);
  const [copied, setCopied] = useState(false);
  const [gpuSkus, setGpuSkus] = useState<GpuSku[]>(GPU_SKU_CATALOG);
  const [selectedGpuId, setSelectedGpuId] = useState(GPU_SKU_CATALOG[3]?.id ?? "rtx-4090");
  const [meterRunning, setMeterRunning] = useState(false);
  const [meterSeconds, setMeterSeconds] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [unpaidCents, setUnpaidCents] = useState(0);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [podDetails, setPodDetails] = useState<JobDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showCLIDialog, setShowCLIDialog] = useState(false);
  const [cliNode, setCLINode] = useState<Node | null>(null);
  const [cmdCopied, setCmdCopied] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copyIdx, setCopyIdx] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    getToken().then(setToken);
  }, [isLoaded, getToken]);

  useEffect(() => {
    if (!token) return;
    fetchNetworkStatus(token);
    fetchPods(token, jobsPage);
    fetchAPIKeys(token);
    fetchMetrics(token);
    fetchBilling(token);
    fetchGpuSkus(token);
    const timer = setInterval(() => {
      fetchNetworkStatus(token);
      fetchPods(token, jobsPage);
      fetchMetrics(token);
      fetchBilling(token);
    }, 10000);
    return () => clearInterval(timer);
  }, [token, jobsPage]);

  const handleJobUpdate = useCallback((update: JobUpdate) => {
    setPods((current) =>
      current.map((job) =>
        job.job_id === update.job_id
          ? { ...job, status: update.status, result_url: update.result_url || job.result_url, error: update.error || job.error }
          : job,
      ),
    );
    if (update.status === "done" || update.status === "error" || update.status === "failed") {
      if (token) fetchBilling(token);
    }
  }, [token]);

  const { status: socketStatus } = useNatsSocket({
    token: token ?? undefined,
    onJobUpdate: handleJobUpdate,
  });

  const fetchPods = async (token: string, page: number) => {
    try {
      const res = await fetch(`${API_URL}/jobs?page=${page}&limit=${JOBS_PER_PAGE}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPods(data.jobs || []);
        setJobsTotal(data.total ?? 0);
        setJobsTotalPages(data.total_pages ?? 1);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchBilling = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/billing/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnpaidCents(data.unpaid_cents ?? 0);
      }
    } catch {
      // silent
    }
  };

  const fetchGpuSkus = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/gpu-skus`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.skus?.length) setGpuSkus(data.skus);
      }
    } catch {
      // silent
    }
  };

  const openJobDetails = async (pod: Pod) => {
    setSelectedPod(pod);
    setPodDetails(null);
    setDetailsLoading(true);
    try {
      const res = await fetch(`${API_URL}/jobs/${pod.job_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPodDetails(await res.json());
      }
    } catch {
      // silent
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeJobDetails = () => {
    setSelectedPod(null);
    setPodDetails(null);
  };

  const openCLIDialog = (node?: Node) => {
    setCLINode(node ?? networkNodes[0] ?? null);
    setShowCLIDialog(true);
    setCmdCopied(false);
  };

  const copyCommand = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCmdCopied(true);
      setTimeout(() => setCmdCopied(false), 2000);
    });
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

  const estimatedHourly = useMemo(() => {
    const nodes = networkNodes.length ? networkNodes : [];
    if (!nodes.length) return "0.00";
    const total = nodes.reduce((sum, n) => sum + (n.price_per_hour ?? (n.hourly_rate_cents ?? 15) / 100), 0);
    return total.toFixed(2);
  }, [networkNodes]);
  const selectedGpu = useMemo(
    () => gpuSkus.find((t) => t.id === selectedGpuId) || gpuSkus[0],
    [selectedGpuId, gpuSkus],
  );
  const meteredCost = useMemo(
    () => ((meterSeconds / 3600) * (selectedGpu?.hourly_rate_usd ?? 0.15)).toFixed(4),
    [meterSeconds, selectedGpu?.hourly_rate_usd],
  );
  const meterTime = useMemo(() => {
    const h = Math.floor(meterSeconds / 3600);
    const m = Math.floor((meterSeconds % 3600) / 60);
    const s = meterSeconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }, [meterSeconds]);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!isLoaded || !token) {
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
          {unpaidCents > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-300">
                <CreditCard className="size-4 shrink-0" />
                <span>
                  Outstanding balance: <strong>{formatCents(unpaidCents)}</strong> from GPU usage
                </span>
              </div>
              <a href="/billing" className="text-xs font-medium text-amber-400 hover:text-amber-300">
                Pay now →
              </a>
            </div>
          )}

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
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {gpuSkus.map((tier) => (
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
                          {tier.memory_gb} GB VRAM &middot; {tier.use_case}
                        </p>
                      </span>
                      <span className="text-sm font-medium text-text-secondary">
                        {formatHourlyRate(tier.hourly_rate_cents)}
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
                  <h3 className="mt-1 text-lg font-semibold text-white">{selectedGpu?.name ?? "GPU"}</h3>
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
                  <span>Server-side billing tracks each job automatically when it starts running on a provider GPU.</span>
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
                <Button variant="secondary" size="sm" onClick={() => openCLIDialog()}>
                  <ArrowUpRight className="size-3.5" />
                  CLI deploy
                </Button>
                <Button variant="primary" size="sm" onClick={() => openCLIDialog(networkNodes[0])}>
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
              <>
                <div className="divide-y divide-white/[0.06]">
                  {pods.map((pod) => (
                    <div key={pod.job_id} className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`size-1.5 rounded-full ${pod.status === "running" || pod.status === "queued" ? "bg-emerald-500/70" : pod.status === "done" ? "bg-blue-500/70" : "bg-amber-500/70"}`} />
                          <p className="text-sm font-medium text-white">{pod.gpu_model || "Tenxo job"}</p>
                          {pod.hourly_rate_cents ? (
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-text-tertiary">
                              {formatHourlyRate(pod.hourly_rate_cents)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-text-tertiary">
                          {pod.job_id} · {pod.status}
                          {pod.elapsed_seconds ? ` · ${formatElapsed(pod.elapsed_seconds)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {(pod.estimated_cost_cents ?? 0) > 0 && (
                          <span className="text-sm font-medium text-text-secondary">
                            {formatCents(pod.estimated_cost_cents!)}
                          </span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openJobDetails(pod)}>
                          <Play className="size-3.5" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {jobsTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-4">
                    <p className="text-xs text-text-tertiary">
                      Page {jobsPage} of {jobsTotalPages} · {jobsTotal} jobs
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={jobsPage <= 1}
                        onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="size-3.5" />
                        Prev
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={jobsPage >= jobsTotalPages}
                        onClick={() => setJobsPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
                        <td className="px-6 py-3 text-xs text-text-secondary">
                          {node.price_per_hour
                            ? `$${node.price_per_hour.toFixed(2)}`
                            : node.hourly_rate_cents
                              ? formatHourlyRate(node.hourly_rate_cents)
                              : "$0.15"}
                        </td>
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
                      <p className="mt-1 text-xs text-text-tertiary">
                        {sku.available}/{sku.total} available · {(sku.vram_mb / 1024).toFixed(0)} GB VRAM
                        {sku.price_per_hour ? ` · $${sku.price_per_hour.toFixed(2)}/hr` : ""}
                      </p>
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
                  Use this Clerk session token with the CLI and matchmaker-protected API routes.
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
              type="password"
              readOnly
              value={token}
              aria-label="API Bearer Token"
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
            <APIKeyList token={token} />
          </section>
        </div>
      )}

      {/* Job Details Dialog */}
      {selectedPod && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => e.key === "Escape" && closeJobDetails()}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0c0c0f] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Job Details</p>
                <h2 className="mt-1 text-base font-semibold text-white">{selectedPod.gpu_model || "Compute job"}</h2>
                <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">{selectedPod.job_id}</p>
              </div>
              <button onClick={closeJobDetails} className="rounded-lg p-1.5 text-text-tertiary hover:bg-white/[0.06]">
                <X className="size-4" />
              </button>
            </div>

            {detailsLoading ? (
              <p className="py-8 text-center text-xs text-text-tertiary">Loading job details...</p>
            ) : (
              <div className="space-y-4">
                <DetailRow label="Status" value={podDetails?.status || selectedPod.status} />
                <DetailRow label="GPU" value={podDetails?.gpu_model || selectedPod.gpu_model || "—"} />
                {selectedPod.hourly_rate_cents || podDetails?.hourly_rate_cents ? (
                  <DetailRow label="Rate" value={formatHourlyRate(selectedPod.hourly_rate_cents || podDetails?.hourly_rate_cents || 0)} />
                ) : null}
                {(selectedPod.estimated_cost_cents ?? 0) > 0 && (
                  <DetailRow label="Estimated charge" value={formatCents(selectedPod.estimated_cost_cents!)} highlight />
                )}
                {selectedPod.elapsed_seconds ? (
                  <DetailRow label="Runtime" value={formatElapsed(selectedPod.elapsed_seconds)} />
                ) : null}
                {podDetails?.error && <DetailRow label="Error" value={podDetails.error} error />}
                {podDetails?.result_url && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Result</p>
                    <a href={podDetails.result_url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-accent-purple hover:underline">
                      {podDetails.result_url}
                    </a>
                  </div>
                )}
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">CLI commands</p>
                  <div className="space-y-2">
                    <CopyableCode text={`tenxo status ${selectedPod.job_id}`} onCopy={copyCommand} copied={cmdCopied} />
                    {podDetails?.result_url && (
                      <CopyableCode text={`tenxo download ${selectedPod.job_id}`} onCopy={copyCommand} copied={cmdCopied} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLI Deploy Dialog */}
      {showCLIDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => e.key === "Escape" && setShowCLIDialog(false)}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0c0c0f] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-accent-purple">
                  <Terminal className="size-4" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest">CLI Deploy</p>
                </div>
                <h2 className="mt-2 text-base font-semibold text-white">
                  {cliNode?.gpu_model || "Deploy to grid"}
                </h2>
                {cliNode && (
                  <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">{cliNode.node_id}</p>
                )}
              </div>
              <button onClick={() => setShowCLIDialog(false)} className="rounded-lg p-1.5 text-text-tertiary hover:bg-white/[0.06]">
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-5 space-y-3">
              <p className="text-[12px] text-text-secondary">
                Deploy from your terminal using the Tenxo CLI. Workloads are end-to-end encrypted.
              </p>
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-tertiary">1. Install the CLI</p>
                <CopyableCode text="pip install tenxo" onCopy={copyCommand} copied={cmdCopied} />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-tertiary">2. Configure API</p>
                <CopyableCode text={`tenxo init --api-url ${API_URL}`} onCopy={copyCommand} copied={cmdCopied} />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-tertiary">3. Run your job</p>
                <CopyableCode
                  text={cliNode
                    ? `tenxo run /path/to/workspace --node-id ${cliNode.node_id}`
                    : "tenxo run /path/to/workspace --node-id <node-id>"}
                  onCopy={copyCommand}
                  copied={cmdCopied}
                />
              </div>
              {!cliNode && networkNodes.length === 0 && (
                <p className="text-[11px] text-amber-400">
                  No idle GPUs available. Check the marketplace or try again later.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowCLIDialog(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const cmd = cliNode
                    ? `tenxo run /path/to/workspace --node-id ${cliNode.node_id}`
                    : "tenxo run /path/to/workspace";
                  copyCommand(cmd);
                  setShowCLIDialog(false);
                }}
              >
                Copy &amp; Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function DetailRow({ label, value, highlight, error }: { label: string; value: string; highlight?: boolean; error?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className={`text-xs font-medium ${error ? "text-red-400" : highlight ? "text-white" : "text-text-secondary"}`}>
        {value}
      </span>
    </div>
  );
}

function CopyableCode({ text, onCopy, copied }: { text: string; onCopy: (t: string) => void; copied: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
      <code className="break-all font-mono text-[12px] text-text-primary">{text}</code>
      <button
        onClick={() => onCopy(text)}
        className="ml-2 shrink-0 rounded-md p-1 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
      >
        {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
      </button>
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
