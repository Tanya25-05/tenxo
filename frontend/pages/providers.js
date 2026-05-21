import { CheckCircle, Copy, Server, ShieldCheck, Terminal } from "lucide-react";
import MarketingPageShell from "../components/MarketingPageShell";
import { signInWithGoogle } from "../lib/authActions";

export default function ProvidersPage() {
  return (
    <MarketingPageShell
      eyebrow="Providers"
      onSignIn={signInWithGoogle}
      title="Turn idle GPUs into network capacity"
      subtitle="Tenxo gives hardware owners a secure onboarding path, a live fleet view, and the foundation for transparent compute earnings."
    >
      <section className="split-panel">
        <div>
          <p className="marketing-kicker">Host onboarding</p>
          <h2>One command to connect a worker</h2>
          <p>
            Install the Rust agent, authenticate with your provider token, and start sending
            heartbeat availability into the Tenxo matchmaker.
          </p>
          <div className="provider-checks">
            {["NVIDIA worker registration", "Heartbeat-based fleet health", "Token-scoped ownership"].map((item) => (
              <span key={item}><CheckCircle size={16} /> {item}</span>
            ))}
          </div>
        </div>
        <div className="terminal-card">
          <div><Terminal size={16} /> tenxo host install</div>
          <code>curl -sSL https://tenxo.com/install.sh | bash -s -- --token $TENXO_TOKEN</code>
          <button onClick={signInWithGoogle}><Copy size={15} /> Get host token</button>
        </div>
      </section>

      <section className="news-grid">
        {[
          [Server, "Fleet visibility", "See registered nodes, status, and heartbeat TTLs in the provider console."],
          [ShieldCheck, "Secure ownership", "Provider hardware stays bound to authenticated accounts and signed API calls."],
          [CheckCircle, "MVP-ready loop", "Connect workers now, then layer pricing and payouts as marketplace volume grows."],
        ].map(([Icon, title, text]) => (
          <article key={title} className="marketing-card">
            <Icon size={22} className="text-[var(--accent-tenxo)]" />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </MarketingPageShell>
  );
}
