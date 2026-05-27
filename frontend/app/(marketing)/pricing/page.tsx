import { Cpu, Server, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

const plans = [
  { icon: Cpu, title: "Developer", price: "$0.15", unit: "per GPU hour estimate", text: "Deploy pods against available decentralized supply." },
  { icon: Server, title: "Provider", price: "0%", unit: "setup fee", text: "Connect hardware and prepare for marketplace payouts." },
  { icon: Sparkles, title: "Startup", price: "50%", unit: "target savings", text: "A cost profile built for fine-tuning and inference teams." },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="border-b border-white/[0.08] py-16 sm:py-20">
        <p className="mb-3 text-xs font-medium text-text-tertiary">Pricing</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Marketplace pricing for AI teams with margin pressure
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-tertiary">
          The MVP uses simple estimated pricing while the marketplace layer matures into utilization-based rates and provider payouts.
        </p>
      </section>

      <section className="grid gap-px py-16 sm:grid-cols-3">
        {plans.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="flex flex-col border border-white/[0.08] bg-[#0c0c0d] p-6 sm:border-r-0 sm:last:border-r">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <Icon className="size-4 text-text-secondary" />
              </div>
              <h2 className="text-sm font-semibold text-white">{p.title}</h2>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight text-white">{p.price}</span>
                <span className="text-xs text-text-tertiary">{p.unit}</span>
              </div>
              <p className="mt-3 flex-1 text-xs leading-relaxed text-text-tertiary">{p.text}</p>
              <Button variant="primary" size="md" className="mt-6 w-full">
                Open console
              </Button>
            </div>
          );
        })}
      </section>

      <section className="border-t border-white/[0.08] py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Pay only for what you use
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-text-tertiary">
          No reservations, no commitments. Billing is by the second with automatic charge and payout settlement.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg">Get started free</Button>
          <Button variant="secondary" size="lg">Talk to sales</Button>
        </div>
      </section>
    </div>
  );
}
