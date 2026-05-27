"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useNatsSocket, type JobUpdate } from "@/components/hooks/useNatsSocket";
import { supabase } from "@/lib/supabaseClient";
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
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [nodes, setNodes] = useState<GpuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [teeOnly, setTeeOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(2);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    async function fetchNodes() {
      try {
        const res = await fetch(`${API_URL}/nodes`);
        if (res.ok) {
          const data = await res.json();
          setNodes(data.nodes || MOCK_NODES);
        } else {
          setNodes(MOCK_NODES);
        }
      } catch {
        setNodes(MOCK_NODES);
      } finally {
        setLoading(false);
      }
    }
    fetchNodes();
  }, []);

  const handleJobUpdate = useCallback((update: JobUpdate) => {
    if (update.status === "done") {
      toast(`Job ${update.job_id.slice(0, 12)}... completed`, "success");
    } else if (update.status === "error") {
      toast(`Deploy failed: ${update.error || "unknown error"}`, "error");
    }
    setDeployingId(null);
  }, [toast]);

  const { status: wsStatus } = useNatsSocket({
    token: session?.access_token,
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
    if (!session?.access_token) {
      toast("Sign in to deploy", "error");
      return;
    }
    setDeployingId(node.node_id);

    try {
      const res = await fetch(`${API_URL}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          job_link: `tenxo://deploy?node=${node.node_id}&gpu=${node.gpu_model}`,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast(`Deploying on ${node.gpu_model} — ${data.status}`, "info");
    } catch (e: any) {
      toast(`Deploy failed: ${e.message}`, "error");
      setDeployingId(null);
    }
  };

  const toggleFilter = (field: string[], value: string, setter: (v: string[]) => void) => {
    setter(field.includes(value) ? field.filter((f) => f !== value) : [...field, value]);
  };

  if (checkingAuth) {
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
                  loading={deployingId === node.node_id}
                  disabled={deployingId === node.node_id}
                  onClick={() => handleDeploy(node)}
                >
                  {deployingId === node.node_id ? "Deploying..." : "Deploy"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
