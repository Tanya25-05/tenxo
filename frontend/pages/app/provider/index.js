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
import { useRequireSession } from "../../../lib/useRequireSession";
import AppShell from "../../../components/AppShell";
import MetricCard from "../../../components/MetricCard";
import { API_URL } from "../../../lib/api";

export default function ProviderDashboard() {
  const { checkingAuth, session } = useRequireSession();
  const [myNodes, setMyNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    fetchMyNodes(session.access_token);
  }, [session?.access_token]);

  const fetchMyNodes = async (token) => {
    try {
      const res = await fetch(`${API_URL}/my-nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyNodes(data.nodes || []);
    } catch (error) {
      console.error("Failed to fetch my nodes", error);
    } finally {
      setLoading(false);
    }
  };

  const avgTtl = useMemo(() => {
    if (!myNodes.length) return 0;
    const total = myNodes.reduce((sum, node) => sum + Number(node.ttl_seconds || 0), 0);
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
      <div className="grid min-h-screen place-items-center text-sm text-[var(--text-muted)]">
        Verifying secure Tenxo session...
      </div>
    );
  }

  return (
    <AppShell
      active="Hardware"
      eyebrow="Provider Console"
      meta={
        <>
          <span className="status-dot" />
          {loading ? "Syncing fleet" : `${myNodes.length} workers online`}
        </>
      }
      role="provider"
      title="Hardware Fleet"
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            accent="blue"
            helper="Worker agents authenticated to your account."
            icon={Server}
            label="Active GPUs"
            value={loading ? "..." : myNodes.length}
          />
          <MetricCard
            accent="green"
            helper="Projected until live billing lands."
            icon={Wallet}
            label="Daily Earnings"
            value="$0.00"
          />
          <MetricCard
            accent="violet"
            helper="Average heartbeat expiry across workers."
            icon={Timer}
            label="Heartbeat TTL"
            value={`${avgTtl}s`}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="tenxo-card p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="tenxo-eyebrow">Onboarding</p>
                <h2 className="text-xl font-semibold text-white">Connect a worker</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Run the agent on an Ubuntu machine with NVIDIA drivers to expose idle GPU
                  capacity to the Tenxo grid.
                </p>
              </div>
              <div className="tenxo-icon-tile">
                <PlugZap size={18} />
              </div>
            </div>

            <div className="tenxo-code flex items-center justify-between gap-4">
              <code className="break-all text-[var(--accent-tenxo)]">{installScript}</code>
              <button
                onClick={handleCopy}
                className="tenxo-btn-ghost shrink-0 px-3"
                title="Copy install command"
              >
                {copied ? <CheckCircle size={17} /> : <Copy size={17} />}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3">
                <ShieldCheck size={16} className="mb-2 text-[var(--accent-tenxo)]" />
                <p className="text-sm font-medium text-white">Token scoped</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Provider ownership is bound through Supabase auth.</p>
              </div>
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3">
                <HardDrive size={16} className="mb-2 text-[var(--accent-blue)]" />
                <p className="text-sm font-medium text-white">Lightweight agent</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Heartbeat data streams into the matchmaker API.</p>
              </div>
            </div>
          </div>

          <div className="tenxo-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-muted)] p-5">
              <div>
                <p className="tenxo-eyebrow">Fleet</p>
                <h2 className="text-xl font-semibold text-white">Registered hardware</h2>
              </div>
              <Activity size={19} className="text-[var(--accent-tenxo)]" />
            </div>
            <div className="overflow-x-auto">
              <table className="tenxo-table">
                <thead>
                  <tr>
                    <th>Node ID</th>
                    <th>Status</th>
                    <th>Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="text-center text-[var(--text-muted)]">
                        Loading fleet data...
                      </td>
                    </tr>
                  ) : myNodes.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-[var(--text-muted)]">
                        No nodes connected yet. Run the install command to add your first GPU.
                      </td>
                    </tr>
                  ) : (
                    myNodes.map((node) => (
                      <tr key={node.node_id}>
                        <td className="font-mono text-[var(--accent-blue)]">{node.node_id}</td>
                        <td>
                          <span className="inline-flex items-center gap-2">
                            <span className="status-dot" />
                            {node.status}
                          </span>
                        </td>
                        <td className="text-[var(--text-muted)]">{node.ttl_seconds}s remaining</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
