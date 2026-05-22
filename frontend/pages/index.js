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
// MarketingNav and MarketingFooter are now provided by the global app shell
import ArchitectureWorkflow from "../components/ArchitectureWorkflow";

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
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
            <button
              onClick={handleSignOut}
              className="tenxo-btn-secondary w-full sm:w-auto"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>

          <div className="workspace-choice-grid">
            <div
              onClick={() => router.push("/app/developer")}
              className="workspace-choice-card group"
            >
              <div
                className="workspace-card-visual developer-visual"
                aria-hidden="true"
              >
                <div className="visual-toolbar">
                  <span>GPU Pods</span>
                  <span>Live</span>
                </div>
                <div className="visual-row visual-row-strong" />
                <div className="visual-row" />
                <div className="visual-split">
                  <span />
                  <span />
                </div>
              </div>
              <div className="workspace-card-content">
                <Terminal size={22} className="text-[var(--text-muted)]" />
                <h2>Developer console</h2>
                <p>
                  Choose GPU tiers, deploy pods, and track pay-as-you-go runtime
                  for AI workloads.
                </p>
                <button className="tenxo-btn-primary" type="button">
                  Enter console <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div
              onClick={() => router.push("/app/provider")}
              className="workspace-choice-card group"
            >
              <div
                className="workspace-card-visual provider-visual"
                aria-hidden="true"
              >
                <div className="visual-toolbar">
                  <span>Worker Fleet</span>
                  <span>Online</span>
                </div>
                <div className="visual-node-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="workspace-card-content">
                <Server size={22} className="text-[var(--text-muted)]" />
                <h2>Provider workspace</h2>
                <p>
                  Connect idle GPUs, verify workers, and prepare hardware for
                  billable compute.
                </p>
                <button className="tenxo-btn-secondary" type="button">
                  Deploy compute <ChevronRight size={16} />
                </button>
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
        <div className="marketing-hero-inner">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">
              <Zap size={15} />
              Decentralized GPU infrastructure
            </p>
            <h1>AI compute infrastructure builders can actually afford</h1>
            <p className="marketing-hero-subtitle">
              Tenxo networks idle distributed GPUs into a secure compute grid
              for training, fine-tuning, and inference at up to 50% less than
              centralized clouds.
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

          <div className="compute-visual product-mockup" aria-hidden="true">
            <div className="mock-window">
              <div className="mock-sidebar">
                <div className="mock-dot-row">
                  <span />
                  <span />
                  <span />
                </div>
                {["Overview", "Pods", "Nodes", "Billing", "API Keys"].map(
                  (item, index) => (
                    <div
                      key={item}
                      className={index === 1 ? "mock-nav-active" : ""}
                    >
                      {item}
                    </div>
                  ),
                )}
              </div>
              <div className="mock-main">
                <div className="mock-toolbar">
                  <span>Tenxo compute grid</span>
                  <span>ENG-2026</span>
                </div>
                <div className="mock-grid">
                  <div className="mock-panel mock-panel-large">
                    <p>GPU pods</p>
                    <h3>Faster app launch</h3>
                    <span>
                      Deploy against verified idle supply from authenticated
                      providers.
                    </span>
                    <div className="mock-line w-3/4" />
                    <div className="mock-line w-1/2" />
                  </div>
                  <div className="mock-panel">
                    <p>In progress</p>
                    <h3>14 GPUs idle</h3>
                    <span>Matchmaker ready</span>
                  </div>
                  <div className="mock-panel">
                    <p>Provider node</p>
                    <h3>RTX worker</h3>
                    <span>Heartbeat 42s</span>
                  </div>
                </div>
              </div>
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
        <ArchitectureWorkflow />

        <section className="feature-callout">
          <div>
            <p className="marketing-kicker">Now building</p>
            <h2>Tenxo launches the decentralized worker protocol</h2>
            <p>
              Lightweight host agents authenticate into the matchmaker, expose
              idle GPU inventory, and let developers schedule compute without
              managing cloud capacity.
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
          <div className="protocol-bot linear-stack" aria-hidden="true">
            <div>
              <Cpu size={20} />
              <span>Register GPU</span>
            </div>
            <div>
              <Lock size={20} />
              <span>Verify token</span>
            </div>
            <div>
              <Layers3 size={20} />
              <span>Schedule pod</span>
            </div>
          </div>
        </section>

        <section className="news-grid">
          {[
            [
              "Build workloads",
              "Deploy pods against live decentralized GPU supply with token-protected APIs.",
            ],
            [
              "Host hardware",
              "Turn underused NVIDIA machines into authenticated workers on the Tenxo network.",
            ],
            [
              "Lower cloud spend",
              "Pool peer-to-peer capacity for AI teams that need better margins.",
            ],
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
              Centralized clouds are expensive because capacity is fragmented
              and scarce. Tenxo makes the unused edge of the GPU market
              discoverable, authenticated, and schedulable.
            </p>
            <div className="report-stats">
              <span>
                <Globe2 size={16} /> Global hosts
              </span>
              <span>
                <Lock size={16} /> Secure sessions
              </span>
              <span>
                <Layers3 size={16} /> Pod orchestration
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
