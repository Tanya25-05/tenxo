import { CheckCircle, Copy, Server, ShieldCheck, Terminal } from "lucide-react";
import { Button } from "@/components/Button";

const checks = [
  "NVIDIA worker registration",
  "Heartbeat-based fleet health",
  "Token-scoped ownership",
];

const cards = [
  { icon: Server, title: "Fleet visibility", text: "See registered nodes, status, and heartbeat TTLs in the provider console." },
  { icon: ShieldCheck, title: "Secure ownership", text: "Provider hardware stays bound to authenticated accounts and signed API calls." },
  { icon: CheckCircle, title: "MVP-ready loop", text: "Connect workers now, then layer pricing and payouts as marketplace volume grows." },
];

export default function ProvidersPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="border-b border-white/[0.06] py-16 sm:py-20">
        <p className="mb-3 text-xs font-medium text-gray-500">Providers</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Turn idle GPUs into network capacity
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">
          Tenxo gives hardware owners a secure onboarding path, a live fleet view, and the foundation for transparent compute earnings.
        </p>
      </section>

      <section className="grid gap-8 py-16 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-medium text-gray-500">Host onboarding</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">One command to connect a worker</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            Install the Rust agent, authenticate with your provider token, and start sending heartbeat availability into the Tenxo matchmaker.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {checks.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-1.5 text-xs text-gray-400">
                <CheckCircle className="size-3.5 text-emerald-400" />
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0d] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Terminal className="size-4" />
            tenxo host install
          </div>
          <pre className="mb-4 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/40 p-4 text-xs text-gray-300 font-mono leading-relaxed">
curl -sSL https://tenxo.com/install.sh | bash -s -- --token $TENXO_TOKEN
          </pre>
          <Button variant="secondary" size="sm">
            <Copy className="size-3.5" />
            Get host token
          </Button>
        </div>
      </section>

      <section className="grid gap-px border-t border-white/[0.06] py-16 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="border border-white/[0.06] bg-[#0c0c0d] p-6 sm:border-r-0 sm:last:border-r">
              <Icon className="mb-4 size-5 text-gray-300" />
              <h3 className="mb-2 text-sm font-semibold text-white">{c.title}</h3>
              <p className="text-xs leading-relaxed text-gray-500">{c.text}</p>
            </div>
          );
        })}
      </section>

      <section className="border-t border-white/[0.06] py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Start earning from your hardware
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
          Connect your GPUs and turn idle silicon into billable compute capacity.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg">Connect a worker</Button>
          <Button variant="secondary" size="lg">Learn more</Button>
        </div>
      </section>
    </div>
  );
}
