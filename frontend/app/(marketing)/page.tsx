import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { HeroGlow } from "@/components/ui/HeroGlow";
import {
  ArrowUpRight,
  Cpu,
  DollarSign,
  Globe,
  Lock,
  Shield,
  Terminal,
  Users,
} from "lucide-react";

const stats = [
  { value: "$0.15/hr", label: "Average GPU cost", border: "border-blue-500/15", bg: "bg-blue-500/[0.04]", text: "text-blue-300" },
  { value: "<100ms", label: "Match latency", border: "border-cyan-500/15", bg: "bg-cyan-500/[0.04]", text: "text-cyan-300" },
  { value: "Zero-trust", label: "Your data stays yours", border: "border-accent-purple/15", bg: "bg-accent-purple/[0.04]", text: "text-accent-purple" },
  { value: "Hardware-secured", label: "TEE-powered execution", border: "border-emerald-500/15", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300" },
];

const features = [
  {
    title: "End-to-End Encryption",
    desc: "Your code and data are encrypted before they leave your machine. Only the GPU agent can decrypt them — the platform never sees your plaintext.",
    icon: Lock,
    tint: "purple" as const,
    border: "border-accent-purple/20",
    bg: "bg-accent-purple/[0.04]",
    text: "text-accent-purple",
    big: true,
  },
  {
    title: "GPU Marketplace",
    desc: "Idle GPUs from around the world are matched to your workload in milliseconds. No queues, no waiting for cluster time.",
    icon: Globe,
    tint: "blue" as const,
    border: "border-blue-500/20",
    bg: "bg-blue-500/[0.04]",
    text: "text-blue-400",
    big: false,
  },
  {
    title: "Hardware Attestation",
    desc: "Every GPU runs inside a hardware-protected environment. You get a verifiable proof that your code ran securely, on real hardware.",
    icon: Shield,
    tint: "orange" as const,
    border: "border-orange-500/20",
    bg: "bg-orange-500/[0.04]",
    text: "text-orange-400",
    big: false,
  },
  {
    title: "CLI & SDKs",
    desc: "Deploy with one command. TypeScript SDK and CLI handle packaging, encryption, and submission. Stream logs in real time.",
    icon: Terminal,
    tint: "cyan" as const,
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/[0.04]",
    text: "text-cyan-400",
    big: false,
  },
  {
    title: "Per-Second Billing",
    desc: "Pay only for what you use. Auto-charge triggers at $1 with saved card or UPI. No reservations, no minimums.",
    icon: DollarSign,
    tint: "emerald" as const,
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.04]",
    text: "text-emerald-400",
    big: false,
  },
];

const gpuTiers = [
  { name: "RTX 4090", vram: "24 GB GDDR6X", payout: "$0.12/hr", price: "$0.34/hr", avail: "High" as const },
  { name: "RTX 4080", vram: "16 GB GDDR6X", payout: "$0.09/hr", price: "$0.26/hr", avail: "High" as const },
  { name: "A100 80GB", vram: "80 GB HBM2e", payout: "$0.55/hr", price: "$1.49/hr", avail: "Medium" as const },
  { name: "A100 40GB", vram: "40 GB HBM2e", payout: "$0.40/hr", price: "$1.10/hr", avail: "Medium" as const },
  { name: "RTX A6000", vram: "48 GB GDDR6", payout: "$0.18/hr", price: "$0.49/hr", avail: "High" as const },
  { name: "L40S", vram: "48 GB GDDR6", payout: "$0.35/hr", price: "$0.95/hr", avail: "Low" as const },
];

const timeline = [
  { year: "Connect", title: "Package and encrypt your workload", desc: "Your code and data are encrypted locally and uploaded. Only the GPU running your job can decrypt them." },
  { year: "Match", title: "Find an available GPU", desc: "The platform routes your encrypted workload to an idle GPU. Your data stays encrypted the entire time." },
  { year: "Attest", title: "Verify the hardware", desc: "The GPU agent proves it's running inside a tamper-proof environment before your code ever arrives." },
  { year: "Execute", title: "Run on remote hardware", desc: "Training, inference, or rendering runs with full GPU acceleration. Network and data are locked down." },
  { year: "Return", title: "Get encrypted results back", desc: "Results are encrypted before leaving the GPU. You download and decrypt them on your machine." },
];

export default function LandingPage() {
  return (
      <div className="mx-auto max-w-[1100px] px-6">
      {/* ─── 1. HERO ─── */}
      <section className="relative min-h-[calc(100vh-3.5rem)] py-section">
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <HeroGlow>
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
            Tap into idle GPUs around the world for AI training, fine-tuning, and inference. Your code and data stay encrypted — only the GPU running your job can see them.
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
            Press <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px]">⌘K</kbd>{" "}
            to navigate
          </p>
        </div>
        </HeroGlow>
      </section>

      {/* ─── 2. STATS BAR ─── */}
      <section className="pb-section">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={`grain relative rounded-lg border ${s.border} ${s.bg} p-5`}>
              <p className={`font-mono text-xl font-semibold ${s.text}`}>{s.value}</p>
              <p className="mt-1 text-[12px] text-text-tertiary">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 3. ARCHITECTURE ─── */}
      <section className="py-section">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            1.0 Architecture
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            Zero-knowledge by design
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[14px] text-text-secondary">
            Your data is encrypted before it leaves your machine. The platform only routes work to GPUs — it never sees your code or data.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grain relative rounded-xl border border-white/[0.08] bg-white/[0.01]">
            <div className="grid grid-cols-3">
              <div className="border-b border-r border-white/[0.08] p-4 text-center text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
                Your Machine
              </div>
              <div className="border-b border-r border-white/[0.08] p-4 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Tenxo Cloud
              </div>
              <div className="border-b border-white/[0.08] p-4 text-center text-[11px] font-semibold uppercase tracking-widest text-accent-neon">
                GPU Agent
              </div>
              <div className="border-b border-r border-white/[0.08] p-5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <Lock className="size-4 text-accent-purple" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-text-primary">Encrypt your workload</p>
                <p className="mt-1 text-[12px] text-text-tertiary">Your machine locks it before sending</p>
              </div>
              <div className="relative border-b border-r border-white/[0.08] p-5">
                <svg className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <Users className="size-4 text-zinc-400" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-text-primary">Route to a GPU</p>
                <p className="mt-1 text-[12px] text-text-tertiary">Tenxo finds an available GPU for you</p>
              </div>
              <div className="border-b p-5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-accent-neon/20 bg-accent-neon/10">
                  <Shield className="size-4 text-accent-neon" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-text-primary">Decrypt and run</p>
                <p className="mt-1 text-[12px] text-text-tertiary">GPU unlocks your workload in a secure zone</p>
              </div>
              <div className="border-r border-white/[0.08] p-5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <Cpu className="size-4 text-accent-purple" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-text-primary">Submit the job</p>
                <p className="mt-1 text-[12px] text-text-tertiary">A single command deploys your workload</p>
              </div>
              <div className="relative border-r border-white/[0.08] p-5">
                <svg className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <Users className="size-4 text-zinc-400" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-text-primary">Queue the work</p>
                <p className="mt-1 text-[12px] text-text-tertiary">The job waits until a GPU is ready</p>
              </div>
              <div className="p-5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-accent-neon/20 bg-accent-neon/10">
                  <Shield className="size-4 text-accent-neon" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-text-primary">Run in isolation</p>
                <p className="mt-1 text-[12px] text-text-tertiary">Your workload is sandboxed with no network access</p>
              </div>
            </div>
          </div>

          <div className="grain relative flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.01] p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded border border-white/[0.08] bg-white/5">
                <Terminal className="size-3 text-text-tertiary" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">Terminal</span>
            </div>
            <pre className="flex-1 overflow-x-auto font-mono text-[12px] leading-[1.8]">
              <span className="text-green-400">$</span> tenxo run --gpu RTX4090 -n pytorch:24.03 {"\n"}
              <span className="text-emerald-400">✓</span>{" "}
              <span className="text-text-secondary">Workload encrypted</span>{" "}
              <span className="text-text-tertiary">(locked on your machine)</span>{"\n"}
              <span className="text-emerald-400">✓</span>{" "}
              <span className="text-text-secondary">GPU located</span>{" "}
              <span className="text-text-tertiary">(nearest available)</span>{"\n"}
              <span className="text-emerald-400">✓</span>{" "}
              <span className="text-text-secondary">Hardware verified</span>{" "}
              <span className="text-text-tertiary">(tamper-proof ✓)</span>{"\n"}
              <span className="text-emerald-400">✓</span>{" "}
              <span className="text-text-secondary">Running on</span>{" "}
              <span className="text-blue-300">RTX 4090 [Secure Zone]</span>{"\n"}
              <span className="text-blue-400">$</span>{" "}
              <span className="text-text-tertiary animate-pulse">▊</span>
            </pre>
          </div>
        </div>
      </section>

      {/* ─── 4. HOW IT WORKS ─── */}
      <section className="py-section">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            2.0 Workflow
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            How it works
          </h2>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <div className="absolute left-[15px] top-0 h-full w-px bg-gradient-to-b from-accent-purple via-accent-neon to-transparent" />
          {timeline.map((step, i) => {
            const colors = [
              { dot: "bg-accent-purple", border: "border-accent-purple/30" },
              { dot: "bg-blue-400", border: "border-blue-400/30" },
              { dot: "bg-cyan-400", border: "border-cyan-400/30" },
              { dot: "bg-orange-400", border: "border-orange-400/30" },
              { dot: "bg-emerald-400", border: "border-emerald-400/30" },
            ];
            const c = colors[i % colors.length];
            return (
              <div key={step.year} className="relative flex gap-6 pb-12 last:pb-0">
                <div className={`relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full border-2 ${c.border} bg-background`}>
                  <div className={`size-2 rounded-full ${c.dot}`} />
                </div>
                <div className="pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 text-[15px] font-semibold text-text-primary">{step.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 5. FEATURE GRID (BENTO) ─── */}
      <section className="py-section">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            3.0 Platform
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            Built for AI workloads
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {features.map((f, i) => {
            const Icon = f.icon;

            if (f.big) {
              return (
                <div
                  key={f.title}
                  className={`grain relative col-span-3 row-span-1 rounded-xl border ${f.border} ${f.bg} p-8 sm:col-span-2 sm:row-span-2`}
                >
                  <div className={`flex size-10 items-center justify-center rounded-lg border ${f.border} ${f.bg}`}>
                    <Icon className={`size-5 ${f.text}`} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-text-primary">{f.title}</h3>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-text-secondary">{f.desc}</p>
                  <div className="mt-6 flex items-center gap-1.5 text-[12px] text-text-tertiary">
                    <div className={`size-1.5 rounded-full ${f.text}`} />
                    industry-standard encryption
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-text-tertiary">
                    <div className={`size-1.5 rounded-full ${f.text}`} />
                    Secure key exchange via relay
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-text-tertiary">
                    <div className={`size-1.5 rounded-full ${f.text}`} />
                    Platform never sees your data
                  </div>
                </div>
              );
            }

            const isLastWide = i === features.length - 1;
            return (
              <div
                key={f.title}
                className={`grain relative rounded-xl border ${f.border} ${f.bg} p-6 ${isLastWide ? "col-span-3 sm:col-span-1" : ""}`}
              >
                <div className={`flex size-9 items-center justify-center rounded-lg border ${f.border} ${f.bg}`}>
                  <Icon className={`size-4 ${f.text}`} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 6. GPU PRICING TABLE ─── */}
      <section className="py-section">
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-purple">
            4.0 Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            Pay only for what you use
          </h2>
          <p className="mt-3 max-w-lg text-[14px] text-text-secondary">
            No reservations, no commitments. You only pay for the seconds you use.
          </p>
        </div>

        <div className="grain relative overflow-hidden rounded-xl border border-white/[0.08]">
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

      {/* ─── 7. DUAL CTA ─── */}
      <section className="py-section">
        <div className="grid gap-6 lg:grid-cols-2">
          <Link href="/developer" className="group block">
            <div className="grain relative rounded-xl border border-accent-purple/20 bg-gradient-to-br from-accent-purple/[0.06] to-transparent p-8 transition-all duration-300 hover:border-accent-purple/30 hover:from-accent-purple/[0.09]">
              <div className="flex size-10 items-center justify-center rounded-lg border border-accent-purple/20 bg-accent-purple/[0.08]">
                <Terminal className="size-5 text-accent-purple" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-text-primary">For Developers</h3>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-text-secondary">
                One command to deploy. Monitor your workloads from the console or CLI. Full SDK included.
              </p>
              <div className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-accent-purple transition-colors group-hover:text-accent-purple/80">
                Open Console <ArrowUpRight className="size-3.5" />
              </div>
            </div>
          </Link>

          <Link href="/providers" className="group block">
            <div className="grain relative rounded-xl border border-accent-neon/20 bg-gradient-to-br from-accent-neon/[0.06] to-transparent p-8 transition-all duration-300 hover:border-accent-neon/30 hover:from-accent-neon/[0.09]">
              <div className="flex size-10 items-center justify-center rounded-lg border border-accent-neon/20 bg-accent-neon/[0.08]">
                <Cpu className="size-5 text-accent-neon" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-text-primary">For Providers</h3>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-text-secondary">
                Earn from your idle GPU. Per-second payouts with automatic monthly settlements. Security built in.
              </p>
              <div className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-accent-neon transition-colors group-hover:text-accent-neon/80">
                Connect GPU <ArrowUpRight className="size-3.5" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ─── 8. BOTTOM CTA ─── */}
      <section className="py-section text-center">
        <div className="grain relative mx-auto max-w-lg rounded-xl border border-accent-purple/20 bg-gradient-to-b from-accent-purple/[0.04] to-transparent px-8 py-12">
          <div className="pointer-events-none absolute inset-0 rounded-xl border border-accent-neon/10" />
          <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-r from-accent-purple/20 via-accent-neon/10 to-accent-purple/20 opacity-50" />
          <Badge variant="accent" className="relative mb-4">
            Beta
          </Badge>
          <h2 className="relative text-2xl font-semibold tracking-tight text-text-primary">
            Ready to deploy on Tenxo?
          </h2>
          <p className="relative mx-auto mt-3 max-w-sm text-[14px] text-text-secondary">
            Connect your GPU or deploy a workload in minutes. Your data stays encrypted, billing by the second.
          </p>
          <div className="relative mt-6 flex items-center justify-center gap-3">
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
          <p className="relative mt-4 text-[12px] text-text-tertiary">
            Press <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px]">⌘K</kbd>{" "}
            for quick navigation
          </p>
        </div>
        </section>
      </div>
  );
}
