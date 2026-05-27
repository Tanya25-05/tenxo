import { Cpu, Gauge, KeyRound, Layers3, Server, Wallet, Zap } from "lucide-react";
import { Button } from "@/components/Button";
import { FloatingTerminal } from "@/components/FloatingTerminal";
import Link from "next/link";

// ─── Data ────────────────────────────────────────────────────────────────────

interface GpuTier {
  name: string;
  vram: string;
  hostPrice: number;
  cloudPrice: number;
  available: number;
}

const gpuTiers: GpuTier[] = [
  { name: "RTX 4090", vram: "24 GB", hostPrice: 0.34, cloudPrice: 0.79, available: 142 },
  { name: "RTX 4080", vram: "16 GB", hostPrice: 0.22, cloudPrice: 0.49, available: 89 },
  { name: "A100 80GB", vram: "80 GB", hostPrice: 1.10, cloudPrice: 2.50, available: 36 },
  { name: "A100 40GB", vram: "40 GB", hostPrice: 0.75, cloudPrice: 1.70, available: 53 },
  { name: "RTX A6000", vram: "48 GB", hostPrice: 0.55, cloudPrice: 1.20, available: 28 },
  { name: "L40S", vram: "48 GB", hostPrice: 0.65, cloudPrice: 1.45, available: 17 },
];

interface ArchStep {
  icon: React.ElementType;
  title: string;
  description: string;
}

const archSteps: ArchStep[] = [
  { icon: Server, title: "Providers connect GPUs", description: "A lightweight Rust agent registers idle hardware with the matchmaker over an authenticated WebSocket session." },
  { icon: KeyRound, title: "Matchmaker verifies supply", description: "The Go API validates signed heartbeats and exposes only authenticated, available GPUs to the marketplace." },
  { icon: Cpu, title: "Developers deploy pods", description: "Pick a GPU tier, specify your image, and deploy—the matchmaker schedules the workload on a verified provider node." },
  { icon: Gauge, title: "Runtime is metered", description: "Usage is tracked per second from pod start to stop, enabling granular pay-as-you-go billing." },
  { icon: Wallet, title: "Charges and payouts settle", description: "Developers pay for compute consumed; providers earn from verified utilization. Razorpay handles the financial layer." },
];

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const features: Feature[] = [
  { icon: Layers3, title: "Secure peer-to-peer infrastructure", description: "ECDH key exchange + AES-GCM encryption between every provider and developer session. Zero-knowledge signaling means the matchmaker never sees your data." },
  { icon: Zap, title: "Pay-as-you-go billing", description: "No reservations, no commitments. Billing is by the second with automatic charge and payout settlement via Razorpay (card + UPI)." },
  { icon: Server, title: "Heartbeat-backed availability", description: "Provider nodes publish signed heartbeats every 30s. The scheduler only routes to nodes with a fresh heartbeat, ensuring live capacity." },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Announcement */}
      <div className="flex items-center justify-center gap-2 border-b border-white/[0.06] py-2.5 text-[11px] text-gray-500">
        <Zap className="size-3 text-gray-400" />
        <span>Beta compute credits available for early AI teams.</span>
        <Link href="/signup" className="ml-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-gray-300 transition-colors hover:bg-white/20">
          Claim your bonus
        </Link>
      </div>

      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden border-b border-white/[0.06] pb-16 pt-12 sm:pt-16 lg:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-gray-500">
              <Zap className="size-3.5 text-gray-400" />
              Decentralized GPU infrastructure
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              AI compute infrastructure builders can actually afford
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-gray-400">
              Tenxo networks idle distributed GPUs into a secure compute grid for training, fine-tuning, and inference at up to <span className="text-gray-200">50% less</span> than centralized clouds.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button size="lg" className="shadow-sm shadow-white/5">
                Get started free
              </Button>
              <Button variant="secondary" size="lg">
                View pricing
              </Button>
            </div>
          </div>
          <div className="hidden lg:block">
            <FloatingTerminal />
          </div>
        </div>
      </section>

      {/* Mobile terminal (below hero on small screens) */}
      <div className="py-6 lg:hidden">
        <FloatingTerminal />
      </div>

      {/* ───── GPU Pricing Grid ───── */}
      <section className="border-b border-white/[0.06] py-16">
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium text-gray-500">GPU marketplace</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Live capacity, transparent pricing
          </h2>
          <p className="mt-2 max-w-lg text-sm text-gray-400">
            Browse available GPU tiers from verified provider nodes. Prices update in real time based on supply and demand.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">GPU</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">VRAM</th>
                <th className="hidden px-4 py-3 text-xs font-semibold text-gray-500 sm:table-cell">Host payout</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">Cloud price</th>
                <th className="hidden px-4 py-3 text-xs font-semibold text-gray-500 md:table-cell">Available</th>
              </tr>
            </thead>
            <tbody>
              {gpuTiers.map((gpu) => (
                <tr
                  key={gpu.name}
                  className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-white">{gpu.name}</td>
                  <td className="px-4 py-3 text-gray-400">{gpu.vram}</td>
                  <td className="hidden px-4 py-3 text-gray-400 sm:table-cell">
                    ${gpu.hostPrice.toFixed(2)}<span className="text-gray-600">/hr</span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">
                    ${gpu.cloudPrice.toFixed(2)}<span className="text-gray-600">/hr</span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-gray-400">
                      <span className="size-1.5 rounded-full bg-emerald-500/70" />
                      {gpu.available} nodes
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───── Architecture Flow ───── */}
      <section className="border-b border-white/[0.06] py-16">
        <div className="mb-12">
          <p className="mb-2 text-xs font-medium text-gray-500">System architecture</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            From idle silicon to billable AI compute
          </h2>
          <p className="mt-2 max-w-lg text-sm text-gray-400">
            Tenxo turns a scattered network of GPUs into a single product loop: hosts contribute capacity, developers schedule workloads, and usage is metered as it runs.
          </p>
        </div>

        <div className="grid gap-px sm:grid-cols-5">
          {archSteps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="relative border border-white/[0.06] bg-[#0c0c0d] p-5 sm:border-r-0 sm:last:border-r"
              >
                <div className="mb-4 flex items-center justify-between">
                  <Icon className="size-4 text-gray-500" />
                  <span className="text-[10px] font-semibold tracking-widest text-gray-600">
                    STEP {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">{step.title}</h3>
                <p className="text-xs leading-relaxed text-gray-500">{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───── Features ───── */}
      <section className="py-16">
        <div className="mb-12">
          <p className="mb-2 text-xs font-medium text-gray-500">Platform features</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Everything you need to deploy distributed GPU workloads
          </h2>
        </div>

        <div className="grid gap-px sm:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="border border-white/[0.06] bg-[#0c0c0d] p-6 sm:border-r-0 sm:last:border-r"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                  <Icon className="size-4 text-gray-300" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-gray-500">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───── Bottom CTA ───── */}
      <section className="border-t border-white/[0.06] py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Compute that follows the shape of your workload.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
          No reservations. No surprise bills. Just GPU capacity, by the second, from a network of trusted providers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg">Open console</Button>
          <Button variant="secondary" size="lg">
            Talk to sales
          </Button>
        </div>
      </section>
    </div>
  );
}
