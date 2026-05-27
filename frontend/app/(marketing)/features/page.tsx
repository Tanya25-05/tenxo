import {
  Activity,
  Cpu,
  Database,
  Gauge,
  Globe2,
  KeyRound,
  Layers3,
  Lock,
  Server,
  ShieldCheck,
  Terminal,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/Button";

const features = [
  { icon: Cpu, title: "Decentralized GPU pooling", text: "Aggregate idle provider GPUs into one schedulable marketplace for training, fine-tuning, and inference." },
  { icon: ShieldCheck, title: "Token-gated workers", text: "Supabase-backed sessions and bearer tokens protect provider registration and developer requests." },
  { icon: Layers3, title: "Pod orchestration", text: "Launch workloads against live inventory while the Go matchmaker tracks nodes, health, and availability." },
  { icon: Server, title: "Rust edge agent", text: "A lightweight host agent turns NVIDIA machines into secure Tenxo workers with heartbeat-based presence." },
  { icon: Database, title: "Artifact storage", text: "Cloudflare R2-ready workflows keep model artifacts, logs, and outputs outside expensive cloud disks." },
  { icon: Gauge, title: "Lower compute cost", text: "Peer-to-peer capacity targets AI teams that need cloud-like access without centralized cloud margins." },
  { icon: Terminal, title: "CLI-first developer flow", text: "Developers can authenticate, deploy, and inspect workloads through a simple command-line interface." },
  { icon: Wallet, title: "Provider earning layer", text: "Hardware owners get a clear path from install command to connected fleet and future payout accounting." },
  { icon: Globe2, title: "Global capacity graph", text: "Tenxo is designed around distributed GPU supply rather than a single region or centralized provider." },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="border-b border-white/[0.06] py-16 sm:py-20">
        <p className="mb-3 text-xs font-medium text-gray-500">Features</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          The MVP surface for decentralized AI compute
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">
          Tenxo connects authentication, worker registration, live inventory, pod deployment, and provider operations into one product-ready interface.
        </p>
      </section>

      <section className="grid gap-px border-b border-white/[0.06] py-16 sm:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="border border-white/[0.06] bg-[#0c0c0d] p-6 sm:border-r-0 sm:last:border-r">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                <Icon className="size-4 text-gray-300" />
              </div>
              <h2 className="mb-2 text-sm font-semibold text-white">{f.title}</h2>
              <p className="text-xs leading-relaxed text-gray-500">{f.text}</p>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-8 py-16 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-500">
            <Activity className="size-3.5" />
            Live platform loop
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            From idle host to deployed workload
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            Providers register GPUs, the matchmaker publishes usable supply, developers launch pods, and secured API calls keep both sides bound to verified sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {([["Auth", KeyRound], ["Register", Server], ["Match", Lock], ["Run", Cpu]] as const).map(([label, Icon]) => (
            <div key={label} className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] px-3.5 py-2 text-xs text-gray-400">
              <Icon className="size-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/[0.06] py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Ready to deploy?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
          Start building on Tenxo&apos;s decentralized GPU grid in minutes.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg">Get started free</Button>
          <Button variant="secondary" size="lg">View pricing</Button>
        </div>
      </section>
    </div>
  );
}
