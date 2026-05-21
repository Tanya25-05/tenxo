import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { signInWithGoogle } from "../lib/authActions";
import {
  ArrowRight,
  ChevronRight,
  Cpu,
  Gift,
  Globe2,
  Layers3,
  Lock,
  LogOut,
  Server,
  Terminal,
  Zap,
} from "lucide-react";
import MarketingNav from "../components/MarketingNav";

export default function LandingPage() {
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "global" });
    setSession(null);
    router.replace("/");
  };

  const handleEmailSubmit = (event) => {
    event.preventDefault();
    handleSignIn();
  };

  if (checkingAuth) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-[var(--text-muted)]">
        Checking Tenxo session...
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center">
          <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="tenxo-eyebrow">Authenticated Workspace</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Welcome to Tenxo
              </h1>
              <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)] sm:text-base">
                Select the console you want to open for this session.
              </p>
            </div>
            <button onClick={handleSignOut} className="tenxo-btn-secondary w-full sm:w-auto">
              <LogOut size={16} />
              Sign out
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <div
              onClick={() => router.push("/app/developer")}
              className="tenxo-card group cursor-pointer p-6 hover:border-[var(--accent-tenxo)] sm:p-8"
            >
              <Terminal size={32} className="mb-6 text-[var(--accent-tenxo)]" />
              <h2 className="mb-2 text-xl font-bold">Deploy Compute</h2>
              <p className="mb-6 text-sm text-[var(--text-muted)]">
                Rent decentralized GPUs at 50% below centralized cloud prices for AI training and inference.
              </p>
              <div className="flex items-center text-sm font-medium text-[var(--accent-tenxo)]">
                Enter Console <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            <div
              onClick={() => router.push("/app/provider")}
              className="tenxo-card group cursor-pointer p-6 hover:border-blue-500 sm:p-8"
            >
              <Server size={32} className="mb-6 text-blue-500" />
              <h2 className="mb-2 text-xl font-bold">Host Hardware</h2>
              <p className="mb-6 text-sm text-[var(--text-muted)]">
                Connect idle GPUs to the Tenxo grid and earn from verified AI workloads.
              </p>
              <div className="flex items-center text-sm font-medium text-blue-500">
                Manage Nodes <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <div className="marketing-announcement">
        <Gift size={15} />
        <span>Beta compute credits available for early AI teams.</span>
        <button onClick={handleSignIn}>Claim your bonus</button>
      </div>

      <section className="marketing-hero">
        <MarketingNav onSignIn={handleSignIn} />

        <div className="marketing-hero-inner">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">
              <Zap size={15} />
              Decentralized GPU infrastructure
            </p>
            <h1>AI compute infrastructure builders can actually afford</h1>
            <p className="marketing-hero-subtitle">
              Tenxo networks idle distributed GPUs into a secure compute grid for training,
              fine-tuning, and inference at up to 50% less than centralized clouds.
            </p>
            <form onSubmit={handleEmailSubmit} className="marketing-email-form">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="What's your work email?"
                aria-label="Work email"
              />
              <button type="submit">Get Started Free</button>
            </form>
          </div>

          <div className="compute-visual" aria-hidden="true">
            <div className="server-rack server-rack-large">
              {Array.from({ length: 42 }).map((_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="server-rack server-rack-small">
              {Array.from({ length: 20 }).map((_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="compute-card-float">
              <Cpu size={20} />
              <span>14,280 CUDA cores pooled</span>
            </div>
          </div>
        </div>

        <div className="trust-strip">
          <p>Built for AI labs, agents, fine-tuning teams, and GPU owners</p>
          <div>
            <span>Supabase Auth</span>
            <span>Go Matchmaker</span>
            <span>Rust Agent</span>
            <span>Cloudflare R2</span>
          </div>
        </div>
      </section>

      <main className="marketing-main">
        <section className="feature-callout">
          <div>
            <p className="marketing-kicker">Now building</p>
            <h2>Tenxo launches the decentralized worker protocol</h2>
            <p>
              Lightweight host agents authenticate into the matchmaker, expose idle GPU
              inventory, and let developers schedule compute without managing cloud capacity.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={handleSignIn} className="tenxo-btn-primary">
                Try Tenxo <ArrowRight size={16} />
              </button>
              <Link href="/features" className="tenxo-btn-secondary">
                View Features
              </Link>
            </div>
          </div>
          <div className="protocol-bot" aria-hidden="true">
            <div className="bot-face">
              <span />
              <span />
            </div>
            <div className="bot-trail" />
          </div>
        </section>

        <section className="news-grid">
          {[
            ["Build workloads", "Deploy pods against live decentralized GPU supply with token-protected APIs."],
            ["Host hardware", "Turn underused NVIDIA machines into authenticated workers on the Tenxo network."],
            ["Lower cloud spend", "Pool peer-to-peer capacity for AI teams that need better margins."],
          ].map(([title, text]) => (
            <article key={title} className="marketing-card">
              <div className="status-dot" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="report-panel">
          <div className="report-cover">
            <p>Tenxo</p>
            <strong>State of AI Compute</strong>
          </div>
          <div>
            <p className="marketing-kicker">Infrastructure report</p>
            <h2>Distributed GPU supply for the next wave of AI startups</h2>
            <p>
              Centralized clouds are expensive because capacity is fragmented and scarce.
              Tenxo makes the unused edge of the GPU market discoverable, authenticated, and schedulable.
            </p>
            <div className="report-stats">
              <span><Globe2 size={16} /> Global hosts</span>
              <span><Lock size={16} /> Secure sessions</span>
              <span><Layers3 size={16} /> Pod orchestration</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
