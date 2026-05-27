import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Cpu, DollarSign, Lock, Shield, Users } from "lucide-react";

const gpuTiers = [
  { name: "RTX 4090", vram: "24 GB GDDR6X", payout: "$0.12/hr", price: "$0.34/hr", avail: "High" },
  { name: "RTX 4080", vram: "16 GB GDDR6X", payout: "$0.09/hr", price: "$0.26/hr", avail: "High" },
  { name: "A100 80GB", vram: "80 GB HBM2e", payout: "$0.55/hr", price: "$1.49/hr", avail: "Medium" },
  { name: "A100 40GB", vram: "40 GB HBM2e", payout: "$0.40/hr", price: "$1.10/hr", avail: "Medium" },
  { name: "RTX A6000", vram: "48 GB GDDR6", payout: "$0.18/hr", price: "$0.49/hr", avail: "High" },
  { name: "L40S", vram: "48 GB GDDR6", payout: "$0.35/hr", price: "$0.95/hr", avail: "Low" },
];

const features = [
  {
    title: "Zero-Knowledge Encryption",
    desc: "Payloads are encrypted end-to-end. The matchmaker routes key material without ever possessing the plaintext key.",
    icon: Lock,
  },
  {
    title: "TEE Attestation",
    desc: "Every GPU agent provides a hardware-backed attestation quote (AMD SEV-SNP / Intel TDX) binding its ephemeral key.",
    icon: Shield,
  },
  {
    title: "Peer-to-Peer Matching",
    desc: "NATS-powered matchmaker connects clients to idle GPUs. No centralized queue, no single point of failure.",
    icon: Users,
  },
  {
    title: "Per-Second Billing",
    desc: "Pay only for what you use. Auto-charge triggers at $1 threshold with saved card or UPI.",
    icon: DollarSign,
  },
];

const timeline = [
  { year: "Connect", title: "Client submits encrypted job", desc: "AES-256-GCM payload is uploaded to ephemeral storage. Only the client holds the key." },
  { year: "Match", title: "Matchmaker routes via NATS", desc: "Zero-knowledge ECDH key material is relayed to an available GPU agent. The matchmaker sees only blinded values." },
  { year: "Attest", title: "Agent verifies in TEE", desc: "The agent checks the client payload inside a Trusted Execution Environment. Docker sandbox enforces --network none." },
  { year: "Execute", title: "GPU processes the workload", desc: "Training, inference, or rendering runs with full GPU passthrough inside the TEE boundary." },
  { year: "Return", title: "Results re-encrypted and returned", desc: "Output is encrypted with the same AES key before leaving the TEE. Client downloads and decrypts locally." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-6">
      {/* ──────────── Hero ──────────── */}
      <section className="relative py-section">
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <div className="relative mx-auto max-w-3xl text-center">
          <Badge variant="accent" className="mb-6">
            Zero-trust GPU grid
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">
            Decentralized Compute,{" "}
            <span className="bg-gradient-to-r from-accent-purple to-accent-neon bg-clip-text text-transparent">
              Secured by TEE
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-text-secondary">
            Network idle distributed GPUs into a zero-trust compute grid. AI training, fine-tuning, and inference on hardware you don&apos;t own — without ever exposing your data.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">
                Open Console <ArrowUpRight className="size-3.5" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="secondary" size="lg">
                Read the docs
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-text-tertiary">
            Press <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px]">⌘K</kbd> to navigate
          </p>
        </div>
      </section>

      {/* ──────────── Architecture Diagram ──────────── */}
      <section className="py-section">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            Architecture
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            Zero-knowledge by design
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[14px] text-text-secondary">
            The matchmaker relays encrypted key material between client and agent without ever seeing the plaintext.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-0 rounded-xl border border-white/[0.08] bg-white/[0.01]">
          {/* Header row */}
          <div className="border-b border-white/[0.08] p-4 text-center text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            Client
          </div>
          <div className="border-b border-white/[0.08] p-4 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Matchmaker
          </div>
          <div className="border-b border-white/[0.08] p-4 text-center text-[11px] font-semibold uppercase tracking-widest text-accent-neon">
            GPU Agent (TEE)
          </div>

          {/* Step 1 */}
          <div className="border-b border-r border-white/[0.08] p-5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <Lock className="size-4 text-accent-purple" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-text-primary">Encrypt payload</p>
            <p className="mt-1 text-[12px] text-text-tertiary">AES-256-GCM with ephemeral key</p>
          </div>
          <div className="relative border-b border-r border-white/[0.08] p-5">
            <svg className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <Users className="size-4 text-zinc-400" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-text-primary">Relay key material</p>
            <p className="mt-1 text-[12px] text-text-tertiary">ECDH XOR &rarr; agent</p>
          </div>
          <div className="border-b p-5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-accent-neon/20 bg-accent-neon/10">
              <Shield className="size-4 text-accent-neon" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-text-primary">Decrypt in TEE</p>
            <p className="mt-1 text-[12px] text-text-tertiary">Key derived via HKDF inside SEV-SNP</p>
          </div>

          {/* Step 2 */}
          <div className="border-r border-white/[0.08] p-5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <Cpu className="size-4 text-accent-purple" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-text-primary">Submit job</p>
            <p className="mt-1 text-[12px] text-text-tertiary">POST /jobs with encrypted link</p>
          </div>
          <div className="relative border-r border-white/[0.08] p-5">
            <svg className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <Users className="size-4 text-zinc-400" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-text-primary">Queue via NATS</p>
            <p className="mt-1 text-[12px] text-text-tertiary">JetStream &rarr; available agent</p>
          </div>
          <div className="p-5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-accent-neon/20 bg-accent-neon/10">
              <Shield className="size-4 text-accent-neon" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-text-primary">Execute in Docker</p>
            <p className="mt-1 text-[12px] text-text-tertiary">--network none --cap-drop ALL</p>
          </div>
        </div>
      </section>

      {/* ──────────── GPU Pricing Table ──────────── */}
      <section className="py-section">
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            Pay only for what you use
          </h2>
          <p className="mt-3 max-w-lg text-[14px] text-text-secondary">
            No reservations, no commitments. Billed by the second with auto-charge settlement.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.08]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">GPU</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">VRAM</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Host Payout</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Cloud Price</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Availability</th>
              </tr>
            </thead>
            <tbody>
              {gpuTiers.map((gpu) => (
                <tr key={gpu.name} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-medium text-text-primary">{gpu.name}</td>
                  <td className="px-5 py-4 font-mono text-text-secondary">{gpu.vram}</td>
                  <td className="px-5 py-4 text-text-secondary">{gpu.payout}</td>
                  <td className="px-5 py-4 font-medium text-text-primary">{gpu.price}</td>
                  <td className="px-5 py-4">
                    <Badge variant={gpu.avail === "High" ? "success" : gpu.avail === "Medium" ? "warning" : "default"}>
                      {gpu.avail}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ──────────── Features Timeline ──────────── */}
      <section className="py-section">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            From encrypted payload to result
          </h2>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <div className="absolute left-[15px] top-0 h-full w-px bg-gradient-to-b from-accent-purple via-accent-neon to-transparent" />
          {timeline.map((step, i) => (
            <div key={step.year} className="relative flex gap-6 pb-12 last:pb-0">
              <div className="relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full border-2 border-accent-purple/30 bg-background">
                <div className="size-2 rounded-full bg-accent-purple" />
              </div>
              <div className="pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
                  {step.year}
                </p>
                <h3 className="mt-1 text-[15px] font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────── Feature Grid ──────────── */}
      <section className="py-section">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            Platform
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            Built for AI workloads
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-white/[0.08] sm:grid-cols-2">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white/[0.01] p-6 transition-colors hover:bg-white/[0.03]">
                <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <Icon className="size-4 text-accent-purple" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ──────────── Bottom CTA ──────────── */}
      <section className="py-section text-center">
        <div className="mx-auto max-w-lg rounded-xl border border-white/[0.08] bg-white/[0.01] px-8 py-12">
          <Badge variant="accent" className="mb-4">Beta</Badge>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
            Ready to deploy on Tenxo?
          </h2>
          <p className="mt-3 text-[14px] text-text-secondary">
            Connect your GPU or deploy a workload in minutes. Zero-trust security, per-second billing.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">
                Get started free <ArrowUpRight className="size-3.5" />
              </Button>
            </Link>
            <Link href="/providers">
              <Button variant="secondary" size="lg">
                Become a provider
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-text-tertiary">
            Press <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px]">⌘K</kbd> for quick navigation
          </p>
        </div>
      </section>
    </div>
  );
}
