import { BookOpen, Code2, Cpu, Server } from "lucide-react";
import MarketingPageShell from "../components/MarketingPageShell";
import { signInWithGoogle } from "../lib/authActions";

export default function DocsPage() {
  return (
    <MarketingPageShell
      eyebrow="Docs"
      onSignIn={signInWithGoogle}
      title="Tenxo integration map"
      subtitle="A lightweight docs hub for the MVP stack: Next.js console, Supabase auth, Go matchmaker, Rust worker, Python CLI, and R2 artifacts."
    >
      <section className="docs-grid">
        {[
          [BookOpen, "Architecture", "Supabase sessions protect user access while the Go API coordinates nodes and pods."],
          [Code2, "Python CLI", "Use authenticated commands to launch workloads and inspect decentralized compute state."],
          [Server, "Provider agent", "Rust workers register GPU availability and refresh liveness through heartbeats."],
          [Cpu, "Developer pods", "Deploy jobs against live GPU inventory surfaced from the matchmaker."],
        ].map(([Icon, title, text]) => (
          <article key={title} className="feature-card">
            <div className="feature-card-icon"><Icon size={21} /></div>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </MarketingPageShell>
  );
}
