"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Cpu,
  FlaskConical,
  Gauge,
  Globe,
  HardDrive,
  Network,
  Search,
  Server,
  Shield,
  ShoppingCart,
  Terminal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useNatsSocket, type JobUpdate } from "@/components/hooks/useNatsSocket";
import { useAuth, useUser } from "@clerk/nextjs";
import { API_URL } from "@/lib/api";

interface GpuNode {
  node_id: string;
  status: string;
  ttl_seconds: number;
  gpu_model?: string;
  vram_gb?: number;
  price_per_hour?: number;
  tee_enabled?: boolean;
  network_speed?: string;
  disk_gb?: number;
  provider?: string;
  region?: string;
}

const MOCK_NODES: GpuNode[] = [
  { node_id: "node-a1b2c3", status: "idle", ttl_seconds: 240, gpu_model: "RTX 4090", vram_gb: 24, price_per_hour: 0.34, tee_enabled: true, network_speed: "10 Gbps", disk_gb: 200, provider: "0x7a3...f9e2", region: "us-east" },
  { node_id: "node-d4e5f6", status: "idle", ttl_seconds: 180, gpu_model: "A100 80GB", vram_gb: 80, price_per_hour: 1.49, tee_enabled: true, network_speed: "25 Gbps", disk_gb: 500, provider: "0x9b1...c4d7", region: "eu-west" },
  { node_id: "node-g7h8i9", status: "idle", ttl_seconds: 300, gpu_model: "RTX 4080", vram_gb: 16, price_per_hour: 0.26, tee_enabled: false, network_speed: "10 Gbps", disk_gb: 150, provider: "0x3c8...a1b5", region: "us-west" },
  { node_id: "node-j0k1l2", status: "idle", ttl_seconds: 120, gpu_model: "RTX A6000", vram_gb: 48, price_per_hour: 0.49, tee_enabled: true, network_speed: "10 Gbps", disk_gb: 300, provider: "0xe5f...7d3a", region: "ap-south" },
  { node_id: "node-m3n4o5", status: "idle", ttl_seconds: 360, gpu_model: "L40S", vram_gb: 48, price_per_hour: 0.95, tee_enabled: true, network_speed: "25 Gbps", disk_gb: 400, provider: "0xf2a...8b6c", region: "eu-central" },
  { node_id: "node-p6q7r8", status: "idle", ttl_seconds: 200, gpu_model: "A100 40GB", vram_gb: 40, price_per_hour: 1.10, tee_enabled: false, network_speed: "10 Gbps", disk_gb: 250, provider: "0xd4e...9f1a", region: "us-east" },
  { node_id: "node-s9t0u1", status: "busy", ttl_seconds: 60, gpu_model: "RTX 4090", vram_gb: 24, price_per_hour: 0.34, tee_enabled: true, network_speed: "10 Gbps", disk_gb: 200, provider: "0x7b2...3c8d", region: "ap-northeast" },
  { node_id: "node-v2w3x4", status: "idle", ttl_seconds: 280, gpu_model: "RTX 4090", vram_gb: 24, price_per_hour: 0.34, tee_enabled: true, network_speed: "10 Gbps", disk_gb: 200, provider: "0x1a9...5e4f", region: "us-west" },
];

const GPU_MODELS = ["RTX 4090", "RTX 4080", "A100 80GB", "A100 40GB", "RTX A6000", "L40S"];
const REGIONS = ["us-east", "us-west", "eu-west", "eu-central", "ap-south", "ap-northeast"];

export default function MarketplacePage() {
  const { toast } = useToast();
  const { isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const [nodes, setNodes] = useState<GpuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GpuNode | null>(null);
  const [copied, setCopied] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [teeOnly, setTeeOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(2);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoaded) return;
    getToken().then(setToken);
  }, [isLoaded, getToken]);

  useEffect(() => {
    if (!token) return;
    const ac = new AbortController();
    async function fetchNodes() {
      try {
        const res = await fetch(`${API_URL}/nodes`, {
          signal: ac.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNodes(data.nodes || MOCK_NODES);
        } else {
          setNodes(MOCK_NODES);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setNodes(MOCK_NODES);
      } finally {
        setLoading(false);
      }
    }
    fetchNodes();
    return () => ac.abort();
  }, [token]);

  const trackUsage = async (jobId: string, action: "start" | "stop") => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/billing/track-usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: user?.id, job_id: jobId, action }),
      });
    } catch {
      // silent — billing is best-effort
    }
  };

  const handleJobUpdate = useCallback((update: JobUpdate) => {
    const tok = tokenRef.current;
    if (update.status === "done") {
      toast(`Job ${update.job_id.slice(0, 12)}... completed`, "success");
      if (tok) {
        fetch(`${API_URL}/billing/track-usage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ user_id: user?.id, job_id: update.job_id, action: "stop" }),
        }).catch(() => {});
      }
    } else if (update.status === "error") {
      toast(`Deploy failed: ${update.error || "unknown error"}`, "error");
      if (tok) {
        fetch(`${API_URL}/billing/track-usage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ user_id: user?.id, job_id: update.job_id, action: "stop" }),
        }).catch(() => {});
      }
    }
  }, [toast, user?.id]);

  const { status: wsStatus } = useNatsSocket({
    token: token ?? undefined,
    onJobUpdate: handleJobUpdate,
  });

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.status !== "idle") return false;
      if (searchQuery && !node.gpu_model?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedModels.length && !selectedModels.includes(node.gpu_model || "")) return false;
      if (teeOnly && !node.tee_enabled) return false;
      if (node.price_per_hour && node.price_per_hour > maxPrice) return false;
      if (selectedRegions.length && !selectedRegions.includes(node.region || "")) return false;
      return true;
    });
  }, [nodes, searchQuery, selectedModels, teeOnly, maxPrice, selectedRegions]);

  const handleDeploy = async (node: GpuNode) => {
    if (!token) {
      toast("Sign in to deploy", "error");
      return;
    }
    setSelectedNode(node);
    setCopied(false);
  };

  const copyCommand = () => {
    if (!selectedNode) return;
    const cmd = `tenxo run /path/to/workspace --node-id ${selectedNode.node_id}`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const closeDialog = () => setSelectedNode(null);

  const toggleFilter = (field: string[], value: string, setter: (v: string[]) => void) => {
    setter(field.includes(value) ? field.filter((f) => f !== value) : [...field, value]);
  };

  if (!isLoaded || !token) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-text-secondary">
        Verifying session...
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* ─── Sidebar Filters ─── */}
      <aside className="hidden w-64 shrink-0 border-r border-white/[0.08] p-5 lg:block">
        <div className="mb-5 flex items-center gap-2 border-b border-white/[0.08] pb-4">
          <ShoppingCart className="size-4 text-text-secondary" />
          <span className="text-[13px] font-medium text-text-primary">Filters</span>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search GPUs..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 pl-9 text-[13px] text-text-primary placeholder-text-tertiary outline-none focus:border-white/[0.15]"
          />
        </div>

        {/* GPU Model */}
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">GPU Model</p>
          <div className="space-y-1">
            {GPU_MODELS.map((model) => (
              <label key={model} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-text-secondary hover:bg-white/[0.02]">
                <input
                  type="checkbox"
                  checked={selectedModels.includes(model)}
                  onChange={() => toggleFilter(selectedModels, model, setSelectedModels)}
                  className="size-3.5 rounded border-white/20 bg-white/5 accent-accent-purple"
                />
                {model}
              </label>
            ))}
          </div>
        </div>

        {/* TEE toggle */}
        <div className="mb-5">
          <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-text-secondary hover:bg-white/[0.02]">
            <input
              type="checkbox"
              checked={teeOnly}
              onChange={() => setTeeOnly(!teeOnly)}
              className="size-3.5 rounded border-white/20 bg-white/5 accent-accent-purple"
            />
            <Shield className="size-3.5 text-accent-purple" />
            TEE enabled only
          </label>
        </div>

        {/* Price range */}
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
            Max price: ${maxPrice.toFixed(2)}/hr
          </p>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full accent-accent-purple"
          />
        </div>

        {/* Region */}
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Region</p>
          <div className="space-y-1">
            {REGIONS.map((region) => (
              <label key={region} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-text-secondary hover:bg-white/[0.02]">
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(region)}
                  onChange={() => toggleFilter(selectedRegions, region, setSelectedRegions)}
                  className="size-3.5 rounded border-white/20 bg-white/5 accent-accent-purple"
                />
                {region}
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 p-5 lg:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-purple">
              GPU Marketplace
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
              Available Compute
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
            <Globe className="size-3.5" />
            {filteredNodes.length} nodes online
            {wsStatus === "connected" && (
              <span className="ml-2 flex items-center gap-1 text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                live
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.01] p-6">
                <div className="mb-3 h-4 w-2/3 animate-pulse rounded bg-white/5" />
                <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-white/5" />
                <div className="mb-4 h-3 w-1/3 animate-pulse rounded bg-white/5" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-white/5" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <Search className="size-5 text-text-tertiary" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">No GPUs match your filters</h3>
            <p className="mt-2 max-w-sm text-[13px] text-text-secondary">
              Try adjusting your search criteria or clearing filters to see more options.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredNodes.map((node) => (
              <Card key={node.node_id} className="flex flex-col">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Server className="size-4 text-accent-purple" />
                      <h3 className="text-[14px] font-semibold text-text-primary">{node.gpu_model}</h3>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                      {node.node_id.slice(0, 16)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-text-primary">
                      ${node.price_per_hour?.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-text-tertiary">/ hr</p>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  <Badge>
                    <HardDrive className="mr-1 size-3" />
                    {node.vram_gb} GB
                  </Badge>
                  <Badge>
                    <Gauge className="mr-1 size-3" />
                    {node.network_speed}
                  </Badge>
                  {node.tee_enabled && (
                    <Badge variant="accent">
                      <Shield className="mr-1 size-3" />
                      TEE
                    </Badge>
                  )}
                  <Badge variant="success">
                    <Cpu className="mr-1 size-3" />
                    idle
                  </Badge>
                </div>

                <div className="mb-4 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  <Globe className="size-3" />
                  {node.region}
                  <span className="mx-1.5">&middot;</span>
                  <FlaskConical className="size-3" />
                  {node.provider}
                </div>

                <Button
                  variant="primary"
                  size="md"
                  className="mt-auto w-full"
                  onClick={() => handleDeploy(node)}
                >
                  Deploy
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ─── CLI Deploy Dialog ─── */}
      {selectedNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Deploy to ${selectedNode.gpu_model}`}
          onKeyDown={(e) => e.key === "Escape" && closeDialog()}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0c0c0f] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-accent-purple">
                  <Terminal className="size-4" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest">
                    CLI Deploy
                  </p>
                </div>
                <h2 className="mt-2 text-base font-semibold text-text-primary">
                  {selectedNode.gpu_model}
                </h2>
                <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                  {selectedNode.node_id}
                </p>
              </div>
              <button
                onClick={closeDialog}
                className="rounded-lg p-1.5 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-5 space-y-3">
              <p className="text-[12px] text-text-secondary">
                Deploy from your terminal using the Tenxo CLI. The encrypted workspace
                is end-to-end encrypted — no one but you and the GPU agent can read it.
              </p>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-tertiary">1. Install the CLI</p>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <code className="font-mono text-[13px] text-text-primary">pip install tenxo</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("pip install tenxo");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="rounded-md p-1 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-tertiary">2. Configure API</p>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <code className="break-all font-mono text-[12px] text-text-primary">
                    tenxo init --api-url https://tenxo-api.onrender.com
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("tenxo init --api-url https://tenxo-api.onrender.com");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="ml-2 shrink-0 rounded-md p-1 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-text-tertiary">
                  Add <code className="rounded bg-white/[0.06] px-1 font-mono">--api-key</code> from the{" "}
                  <a href="/developer" className="text-accent-purple underline hover:no-underline">
                    Developer Console
                  </a>{" "}
                  if required.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-tertiary">3. Run your job</p>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <code className="break-all font-mono text-[12px] text-text-primary">
                    tenxo run /path/to/workspace --node-id {selectedNode.node_id}
                  </code>
                  <button
                    onClick={copyCommand}
                    className="ml-2 shrink-0 rounded-md p-1 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={closeDialog}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  copyCommand();
                  closeDialog();
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
