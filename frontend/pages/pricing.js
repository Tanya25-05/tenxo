import { Cpu, Server, Sparkles } from "lucide-react";
import MarketingPageShell from "../components/MarketingPageShell";
import { signInWithGoogle } from "../lib/authActions";

export default function PricingPage() {
  return (
    <MarketingPageShell
      eyebrow="Pricing"
      onSignIn={signInWithGoogle}
      title="Marketplace pricing for AI teams with margin pressure"
      subtitle="The MVP uses simple estimated pricing while the marketplace layer matures into utilization-based rates and provider payouts."
    >
      <section className="pricing-grid">
        {[
          [Cpu, "Developer", "$0.15", "per GPU hour estimate", "Deploy pods against available decentralized supply."],
          [Server, "Provider", "0%", "setup fee", "Connect hardware and prepare for marketplace payouts."],
          [Sparkles, "Startup", "50%", "target savings", "A cost profile built for fine-tuning and inference teams."],
        ].map(([Icon, title, price, unit, text]) => (
          <article key={title} className="pricing-card">
            <Icon size={24} />
            <h2>{title}</h2>
            <div><strong>{price}</strong><span>{unit}</span></div>
            <p>{text}</p>
            <button onClick={signInWithGoogle} className="tenxo-btn-primary">Open console</button>
          </article>
        ))}
      </section>
    </MarketingPageShell>
  );
}
