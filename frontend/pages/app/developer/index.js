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
import { useRequireSession } from "../../../lib/useRequireSession";
import AppShell from "../../../components/AppShell";
import MetricCard from "../../../components/MetricCard";
import { API_URL } from "../../../lib/api";
import { API_URL } from "../../../lib/api";

const gpuTiers = [
  {
    id: "rtx-4090",
    name: "RTX 4090",
    memory: "24 GB",
    useCase: "Fine-tuning, inference",
    price: 0.15,
  },
  {
    id: "a5000",
    name: "RTX A5000",
    memory: "24 GB",
    useCase: "Stable training runs",
    price: 0.22,
  },
  {
    id: "a100",
    name: "A100",
    memory: "40 GB",
    useCase: "Large model training",
    price: 0.75,
  },
];

export default function DeveloperDashboard() {
  const { checkingAuth, session } = useRequireSession();
  const [activeTab, setActiveTab] = useState("pods");
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [networkNodes, setNetworkNodes] = useState([]);
  const [loadingNetwork, setLoadingNetwork] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedGpuId, setSelectedGpuId] = useState(gpuTiers[0].id);
  const [meterRunning, setMeterRunning] = useState(false);
  const [meterSeconds, setMeterSeconds] = useState(0);

  useEffect(() => {
    if (!session?.access_token) return;
    fetchNetworkStatus(session.access_token);
  }, [session?.access_token]);

  useEffect(() => {
    async function fetchPods() {
      try {
        const res = await fetch(`${API_URL}/pods`);
        if (res.ok) setPods(await res.json());
      } catch (error) {
        console.error("Failed to fetch pods", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPods();
  }, []);

  useEffect(() => {
    if (!meterRunning) return undefined;
    const timer = setInterval(() => {
      setMeterSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [meterRunning]);

  const fetchNetworkStatus = async (token) => {
    try {
      const res = await fetch(`${API_URL}/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setNetworkNodes(data.nodes || []);
    } catch (error) {
      console.error("Failed to fetch grid status", error);
    } finally {
      setLoadingNetwork(false);
    }
  };

  const estimatedHourly = useMemo(
    () => (networkNodes.length * 0.15).toFixed(2),
    [networkNodes.length]
  );
  const selectedGpu = useMemo(
    () => gpuTiers.find((tier) => tier.id === selectedGpuId) || gpuTiers[0],
    [selectedGpuId]
  );
  const meteredCost = useMemo(
    () => ((meterSeconds / 3600) * selectedGpu.price).toFixed(4),
    [meterSeconds, selectedGpu.price]
  );
  const meterTime = useMemo(() => {
    const hours = Math.floor(meterSeconds / 3600);
    const minutes = Math.floor((meterSeconds % 3600) / 60);
    const seconds = meterSeconds % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }, [meterSeconds]);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(session.access_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (checkingAuth || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-[var(--text-muted)]">
        Verifying secure Tenxo session...
      </div>
    );
  }

  return (
    <AppShell
      active={activeTab === "billing" ? "API & Billing" : "Compute"}
      eyebrow="Developer Console"
      meta={
        <>
          <span className="status-dot" />
          {loadingNetwork ? "Scanning grid" : `${networkNodes.length} GPUs idle`}
        </>
      }
      onSelect={setActiveTab}
      role="developer"
      title={activeTab === "billing" ? "API, Billing & Access" : "GPU Compute Pods"}
    >
      {activeTab === "pods" ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              accent="green"
              helper="Live nodes reported by the matchmaker."
              icon={Cpu}
              label="Available GPUs"
              value={loadingNetwork ? "..." : networkNodes.length}
            />
            <MetricCard
              accent="blue"
              helper="Current developer workloads from /pods."
              icon={Layers3}
              label="Active Pods"
              value={loading ? "..." : pods.length}
            />
            <MetricCard
              accent="violet"
              helper="Baseline marketplace estimate."
              icon={Sparkles}
              label="Grid Cost / Hr"
              value={`$${estimatedHourly}`}
            />
          </section>

          <section className="tenxo-card overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-[var(--border-muted)] p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="tenxo-eyebrow">Pay as you go</p>
                <h2 className="text-xl font-semibold text-white">Choose compute and meter usage</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Select the GPU class for a workload. Runtime is tracked by the second and priced hourly.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={meterRunning ? "tenxo-btn-secondary" : "tenxo-btn-primary"}
                  onClick={() => setMeterRunning((running) => !running)}
                >
                  <Clock3 size={16} />
                  {meterRunning ? "Pause meter" : "Start meter"}
                </button>
                <button
                  className="tenxo-btn-ghost"
                  onClick={() => {
                    setMeterRunning(false);
                    setMeterSeconds(0);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="grid gap-3 border-b border-[var(--border-muted)] p-5 lg:border-b-0 lg:border-r">
                {gpuTiers.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedGpuId(tier.id)}
                    className={`gpu-tier-card ${selectedGpuId === tier.id ? "gpu-tier-card-active" : ""}`}
                  >
                    <span>
                      <strong>{tier.name}</strong>
                      <small>{tier.memory} VRAM · {tier.useCase}</small>
                    </span>
                    <span>${tier.price.toFixed(2)}/hr</span>
                  </button>
                ))}
              </div>

              <div className="usage-meter-panel">
                <div>
                  <p className="tenxo-eyebrow">Current meter</p>
                  <h3>{selectedGpu.name}</h3>
                </div>
                <div className="usage-meter-readout">
                  <Clock3 size={18} />
                  <span>{meterTime}</span>
                </div>
                <div className="usage-meter-cost">
                  <span>Estimated charge</span>
                  <strong>${meteredCost}</strong>
                </div>
                <div className="usage-meter-note">
                  <Gauge size={16} />
                  <span>Charges scale with active runtime. Production billing should be backed by server-side pod events.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="tenxo-card overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-[var(--border-muted)] p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="tenxo-eyebrow">Deploy</p>
                <h2 className="text-xl font-semibold text-white">Compute pods</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Launch decentralized containers against the live GPU supply.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="tenxo-btn-secondary">
                  <ArrowUpRight size={16} />
                  CLI deploy
                </button>
                <button className="tenxo-btn-primary">
                  <Plus size={16} />
                  Deploy pod
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                Loading pods...
              </div>
            ) : pods.length === 0 ? (
              <div className="grid place-items-center px-6 py-14 text-center">
                <div className="tenxo-icon-tile mb-4 h-12 w-12">
                  <Cpu size={22} />
                </div>
                <h3 className="text-lg font-semibold text-white">No active pods yet</h3>
                <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
                  Start with a small inference pod, then scale into idle GPUs as demand grows.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {pods.map((pod) => (
                  <div
                    key={pod.id}
                    className="flex flex-col gap-4 p-5 transition hover:bg-white/[0.035] md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="status-dot" />
                        <p className="font-semibold text-white">{pod.name}</p>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-[var(--text-soft)]">
                        {pod.id}
                      </p>
                    </div>
                    <button className="tenxo-btn-ghost">
                      <Play size={16} />
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="tenxo-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-muted)] p-5">
              <div>
                <p className="tenxo-eyebrow">Marketplace</p>
                <h2 className="text-xl font-semibold text-white">Idle GPU supply</h2>
              </div>
              <div className="hidden items-center gap-2 text-sm text-[var(--text-muted)] md:flex">
                <ShieldCheck size={16} className="text-[var(--accent-tenxo)]" />
                Authenticated providers
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="tenxo-table">
                <thead>
                  <tr>
                    <th>Node ID</th>
                    <th>Status</th>
                    <th>Price / Hr</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {networkNodes.length === 0 && !loadingNetwork ? (
                    <tr>
                      <td colSpan="4" className="text-center text-[var(--text-muted)]">
                        No idle nodes currently available on the grid.
                      </td>
                    </tr>
                  ) : (
                    networkNodes.map((node) => (
                      <tr key={node.node_id}>
                        <td className="font-mono text-[var(--accent-blue)]">
                          {node.node_id.substring(0, 12)}...
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-2">
                            <span className="status-dot" />
                            {node.status}
                          </span>
                        </td>
                        <td>$0.15</td>
                        <td className="text-[var(--text-muted)]">Ready for match</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="tenxo-card p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="tenxo-eyebrow">Authentication</p>
                <h2 className="text-xl font-semibold text-white">Bearer token</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Use this Supabase JWT with the CLI and matchmaker-protected API routes.
                </p>
              </div>
              <div className="tenxo-icon-tile">
                <KeyRound size={18} />
              </div>
            </div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              API Bearer Token
            </label>
            <input
              type="text"
              readOnly
              value={session.access_token}
              className="tenxo-input mb-4 font-mono text-xs text-[var(--text-muted)]"
            />
            <button className="tenxo-btn-primary" onClick={handleCopyToken}>
              <CreditCard size={16} />
              {copied ? "Copied" : "Copy token"}
            </button>
          </section>

          <section className="tenxo-card p-6">
            <p className="tenxo-eyebrow">Controls</p>
            <h2 className="text-xl font-semibold text-white">MVP readiness</h2>
            <div className="mt-5 space-y-4">
              {[
                ["Supabase auth", "Active session gated console"],
                ["Go matchmaker", "Live nodes and pods endpoints wired"],
                ["Secure workers", "Token-based API access ready"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.07] bg-white/[0.035] p-3">
                  <span className="text-sm text-[var(--text-muted)]">{label}</span>
                  <span className="text-sm font-medium text-white">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
