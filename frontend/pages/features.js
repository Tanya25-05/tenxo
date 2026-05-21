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
import MarketingPageShell from "../components/MarketingPageShell";
import { signInWithGoogle } from "../lib/authActions";

const features = [
  {
    icon: Cpu,
    title: "Decentralized GPU pooling",
    text: "Aggregate idle provider GPUs into one schedulable marketplace for training, fine-tuning, and inference.",
  },
  {
    icon: ShieldCheck,
    title: "Token-gated workers",
    text: "Supabase-backed sessions and bearer tokens protect provider registration and developer requests.",
  },
  {
    icon: Layers3,
    title: "Pod orchestration",
    text: "Launch workloads against live inventory while the Go matchmaker tracks nodes, health, and availability.",
  },
  {
    icon: Server,
    title: "Rust edge agent",
    text: "A lightweight host agent turns NVIDIA machines into secure Tenxo workers with heartbeat-based presence.",
  },
  {
    icon: Database,
    title: "Artifact storage",
    text: "Cloudflare R2-ready workflows keep model artifacts, logs, and outputs outside expensive cloud disks.",
  },
  {
    icon: Gauge,
    title: "Lower compute cost",
    text: "Peer-to-peer capacity targets AI teams that need cloud-like access without centralized cloud margins.",
  },
  {
    icon: Terminal,
    title: "CLI-first developer flow",
    text: "Developers can authenticate, deploy, and inspect workloads through a simple command-line interface.",
  },
  {
    icon: Wallet,
    title: "Provider earning layer",
    text: "Hardware owners get a clear path from install command to connected fleet and future payout accounting.",
  },
  {
    icon: Globe2,
    title: "Global capacity graph",
    text: "Tenxo is designed around distributed GPU supply rather than a single region or centralized provider.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingPageShell
      eyebrow="Features"
      onSignIn={signInWithGoogle}
      title="The MVP surface for decentralized AI compute"
      subtitle="Tenxo connects authentication, worker registration, live inventory, pod deployment, and provider operations into one product-ready interface."
    >
      <section className="feature-card-grid">
        {features.map((feature) => (
          <article key={feature.title} className="feature-card">
            <div className="feature-card-icon">
              <feature.icon size={21} />
            </div>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>

      <section className="feature-band">
        <div>
          <p className="marketing-kicker">
            <Activity size={15} />
            Live platform loop
          </p>
          <h2>From idle host to deployed workload</h2>
          <p>
            Providers register GPUs, the matchmaker publishes usable supply, developers launch pods,
            and secured API calls keep both sides bound to verified sessions.
          </p>
        </div>
        <div className="feature-flow">
          {[
            [KeyRound, "Auth"],
            [Server, "Register"],
            [Lock, "Match"],
            [Cpu, "Run"],
          ].map(([Icon, label]) => (
            <div key={label}>
              <Icon size={18} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}
