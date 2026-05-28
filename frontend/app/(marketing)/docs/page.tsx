import { BookOpen, CheckCircle, Cpu, KeyRound, Server, ShieldCheck, Terminal, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "developer-guide", label: "Developer Guide" },
  { id: "provider-guide", label: "Provider Guide" },
  { id: "cli-reference", label: "CLI Reference" },
  { id: "api-reference", label: "API Reference" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export default function DocsPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] px-4 sm:px-6">
      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden w-56 shrink-0 border-r border-white/[0.08] py-12 lg:block">
        <nav className="sticky top-20 space-y-1">
          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            Docs
          </p>
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block rounded-md px-3 py-1.5 text-[13px] text-text-secondary transition-colors hover:text-text-primary"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 py-12 pl-0 lg:pl-10">
        {/* ── Mobile section nav ── */}
        <div className="mb-8 flex flex-wrap gap-2 lg:hidden">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary"
            >
              {s.label}
            </a>
          ))}
        </div>

        {/* ═══════════════════ OVERVIEW ═══════════════════════════ */}
        <section id="overview" className="scroll-mt-20">
          <p className="mb-3 text-xs font-medium text-text-tertiary">Overview</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Tenxo documentation
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-tertiary">
            Tenxo is a decentralized GPU compute grid that connects hardware providers with AI developers.
            Jobs are end-to-end encrypted, billed per-second, and routed through a zero-knowledge matchmaker
            that never sees your data or encryption keys.
          </p>

          {/* ── How it works steps ── */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Cpu, title: "1. Providers register GPUs", text: "Hardware owners install the Rust edge agent to advertise idle GPU capacity to the matchmaker." },
              { icon: KeyRound, title: "2. Developers submit jobs", text: "Encrypted payloads are uploaded, keys are exchanged via ECDH, and the matchmaker routes work to available agents." },
              { icon: Lock, title: "3. Zero-knowledge execution", text: "The matchmaker never possesses the AES encryption key. Only the client and GPU agent can decrypt the payload." },
            ].map((s) => (
              <Card key={s.title} hover={false}>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <s.icon className="size-4 text-text-secondary" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-white">{s.title}</h3>
                <p className="text-xs leading-relaxed text-text-tertiary">{s.text}</p>
              </Card>
            ))}
          </div>

          {/* ── Refernce architecture ── */}
          <h2 className="mb-4 mt-12 text-lg font-semibold text-white">Reference architecture</h2>
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-5">
            <pre className="text-[11px] leading-relaxed text-text-secondary font-mono">{`                    +---------+       +------------+       +------------+
                    |  Client |       | Matchmaker |       |    GPU     |
                    | (Alice) |       |  (Go HTTP) |       |  Provider  |
                    +---------+       +------------+       +------------+
                         |                   |                   |
    1. Install/Sign in   |                   |                   |
       ─────────────────>|                   |                   |
       POST /presign     |                   |                   |
       <────── URLs ─────|                   |                   |
    2. Upload encrypted   |                   |                   |
       payload (PUT)      |                   |                   |
       ──────────────────|──────────────────>|                   |
                          |  (stores .enc)    |                   |
    3. ECDH key exchange  |                   |                   |
       via signaling     |                   |                   |
       ─────────────────────────────────────>|─ ─ ─ ─ ─ ─ ─ ─ >|
                          |                   |                   |
    4. Agent decrypts     |                   |                   |
       & runs job         |                   |                   |
       <──────────────────────────────────────|──────────────────|
                          |                   |                   |
    5. Download results   |                   |                   |
       <──────────────────|                   |                   |

  ┌──────────────────────────────────────────────────────────────────────┐
  │                    ZERO-KNOWLEDGE PROPERTY                           │
  │                                                                      │
  │  Client: AES_key = HKDF(ECDH(client_priv, agent_pub))                │
  │  Client sends: AES_key XOR ECDH(client_priv, agent_pub)              │
  │  Agent recovers: ECDH(agent_priv, client_pub) XOR received_value     │
  │                                                                      │
  │  Matchmaker sees only the XOR'd value — never the plain AES key.     │
  └──────────────────────────────────────────────────────────────────────┘`}</pre>
          </div>
        </section>

        {/* ═══════════════════ QUICKSTART ═══════════════════════════ */}
        <section id="quickstart" className="mt-16 scroll-mt-20">
          <p className="mb-3 text-xs font-medium text-text-tertiary">Quickstart</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Get started in two paths
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-tertiary">
            Choose your role below. Developers submit compute jobs. Providers supply GPU capacity.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {/* Developer card */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <Terminal className="size-4 text-text-secondary" />
              </div>
              <h3 className="text-sm font-semibold text-white">For developers</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
                Run AI workloads on the decentralized grid. Sign in with Supabase, get an API key auto-generated,
                then submit encrypted jobs through the CLI or dashboard.
              </p>
              <a href="#developer-guide" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-accent-neon">
                Read developer guide →
              </a>
            </div>

            {/* Provider card */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <Server className="size-4 text-text-secondary" />
              </div>
              <h3 className="text-sm font-semibold text-white">For providers</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
                Turn idle GPU hardware into billable compute capacity. Install the Rust agent, register your node,
                and start earning when jobs are routed to your machine.
              </p>
              <a href="#provider-guide" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-accent-neon">
                Read provider guide →
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════ DEVELOPER GUIDE ═══════════════════════ */}
        <section id="developer-guide" className="mt-16 scroll-mt-20">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded border border-white/[0.08] bg-white/[0.03]">
              <Terminal className="size-3 text-text-secondary" />
            </span>
            <p className="text-xs font-medium text-text-tertiary">Developer Guide</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Submitting compute jobs
          </h2>

          {/* Step 1 */}
          <div className="mt-8 space-y-8">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">1</span>
                Sign in to the console
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                Visit the <a href="/login" className="text-accent-purple hover:text-accent-neon">Tenxo Console</a> and sign in with
                Supabase (GitHub or email). Once authenticated, an API key with <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">txn_</code> prefix
                is auto-generated for your account.
              </p>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">2</span>
                Create a presigned upload
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                Use your Supabase JWT or API key to call <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">POST /presign</code>.
                This returns upload URLs and a server-generated job ID. An encryption key is derived automatically.
              </p>
              <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-4">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-text-secondary font-mono">{`curl -X POST https://matchmaker.tenxo.ai/presign \
  -H "Authorization: Bearer $TENXO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enc_key_b64": ""}'`}</pre>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">3</span>
                Upload encrypted payload
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                Encrypt your workload with the AES-256-GCM key, then PUT it to the <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">upload_url</code>.
              </p>
              <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-4">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-text-secondary font-mono"># Python SDK handles encryption automatically:
tenxo run payload.tar.gz --gpu a5000

# Manual:
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @encrypted_payload.bin</pre>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">4</span>
                Check job status &amp; download results
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                Poll <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">GET /jobs/&lt;job_id&gt;</code> for status changes. Once complete,
                download from the result URL and decrypt with your AES key.
              </p>
              <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-4">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-text-secondary font-mono">{`curl -H "Authorization: Bearer $TENXO_TOKEN" \
  https://matchmaker.tenxo.ai/jobs/job-a1b2c3d4

# Response:
# {"job_id":"job-a1b2c3d4","status":"completed","result_url":"..."}`}</pre>
              </div>
            </div>
          </div>

          {/* ── Billing section ── */}
          <h3 className="mt-12 text-base font-semibold text-white">Billing &amp; credits</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
            Tenxo uses a <strong>pre-paid credits model</strong> (RunPod model). Add credits via Razorpay (card or UPI),
            and usage is deducted per-second while your job runs. Failed jobs are billed only for actual compute time.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Per-second billing", text: "Only pay for what you use. 1 second minimum." },
              { label: "Pre-paid credits", text: "Top up your balance before submitting jobs." },
              { label: "Auto-stop", text: "Jobs that fail are stopped automatically — no surprise charges." },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-medium text-white">{c.label}</p>
                <p className="mt-1 text-[11px] text-text-tertiary">{c.text}</p>
              </div>
            ))}
          </div>

          {/* ── GPU tiers ── */}
          <h3 className="mt-10 text-base font-semibold text-white">Available GPU tiers</h3>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">GPU</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">VRAM</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Use case</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Price / hr</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["RTX 4090", "24 GB", "Fine-tuning, inference", "$0.15"],
                  ["RTX A5000", "24 GB", "Stable training runs", "$0.22"],
                  ["A100", "40 GB", "Large model training", "$0.75"],
                ].map(([gpu, vram, use, price]) => (
                  <tr key={gpu} className="border-b border-white/[0.03] last:border-0">
                    <td className="px-5 py-3 text-xs text-text-secondary">{gpu}</td>
                    <td className="px-5 py-3 text-xs text-text-tertiary">{vram}</td>
                    <td className="px-5 py-3 text-xs text-text-tertiary">{use}</td>
                    <td className="px-5 py-3 text-xs text-text-secondary font-mono">{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════ PROVIDER GUIDE ═══════════════════════ */}
        <section id="provider-guide" className="mt-16 scroll-mt-20">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded border border-white/[0.08] bg-white/[0.03]">
              <Server className="size-3 text-text-secondary" />
            </span>
            <p className="text-xs font-medium text-text-tertiary">Provider Guide</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Connecting your GPU hardware
          </h2>

          <div className="mt-8 space-y-8">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">1</span>
                Prerequisites
              </h3>
              <ul className="mt-3 space-y-2">
                {[
                  "Linux machine (Ubuntu 22.04+ recommended)",
                  "NVIDIA GPU with drivers installed (nvidia-smi works)",
                  "Docker installed (for sandboxed job execution)",
                  "Open port 8080 for WebSocket communication",
                  "A Tenxo account (sign up at console.tenxo.ai)",
                ].map((req) => (
                  <li key={req} className="flex items-start gap-2 text-sm text-text-tertiary">
                    <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">2</span>
                Install the edge agent
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                Run the one-command installer. It downloads the Rust binary, sets up a systemd service,
                and connects to the Tenxo matchmaker.
              </p>
              <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-4">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-text-secondary font-mono">curl -fsSL https://tenxo-api.onrender.com/install.sh | bash -s -- --owner YOUR_USER_ID</pre>
              </div>
              <p className="mt-3 text-xs text-text-tertiary">
                Your user ID is available in the{" "}
                <a href="/provider" className="text-accent-purple hover:text-accent-neon">Provider Console</a>{" "}
                after signing in.
              </p>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">3</span>
                Heartbeat &amp; liveness
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                Once running, the agent sends heartbeat signals every 30 seconds. Your node appears
                in the marketplace as <strong>idle</strong> and becomes available for job routing.
              </p>
              <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-medium text-white">Agent heartbeat format</p>
                <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-text-tertiary font-mono">{
`{
  "type": "heartbeat",
  "payload": {
    "node_id": "gpu-node-001",
    "gpu_model": "RTX 4090",
    "gpu_vram_mb": 24576,
    "tee_attested": true,
    "load": 0.0
  }
}`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">4</span>
                TEE attestation (optional)
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                If your machine supports AMD SEV-SNP or Intel TDX, the agent automatically generates
                an attestation quote during the signaling handshake. Verified nodes display a
                <span className="ml-1 inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Verified</span> badge in the marketplace.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[0.08] px-4 py-3">
                  <p className="text-xs font-medium text-white">With TEE</p>
                  <p className="mt-1 text-[11px] text-text-tertiary">Full challenge-response attestation. report_data[32..64] verified.</p>
                </div>
                <div className="rounded-lg border border-white/[0.08] px-4 py-3">
                  <p className="text-xs font-medium text-white">Without TEE</p>
                  <p className="mt-1 text-[11px] text-text-tertiary">Node runs as "Unverified". Jobs still accepted — no badge.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-text-secondary">5</span>
                Monitor your fleet
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
                Visit the <a href="/provider" className="text-accent-purple hover:text-accent-neon">Provider Console</a> to see all your registered nodes,
                their current status, GPU specs, TEE verification state, and heartbeat TTLs.
              </p>
            </div>
          </div>

          {/* ── Provider earnings ── */}
          <h3 className="mt-12 text-base font-semibold text-white">Provider earnings</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
            Providers earn <strong>93%</strong> of the compute price paid by developers. Payouts are processed
            weekly via Stripe Connect (minimum $50 threshold). Earnings accumulate per-second based on
            actual job execution time.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "93% payout share", text: "You keep almost all of the compute revenue." },
              { label: "Weekly payouts", text: "Automatic transfers every Monday." },
              { label: "$50 minimum", text: "Payouts trigger once earnings exceed $50." },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-medium text-white">{c.label}</p>
                <p className="mt-1 text-[11px] text-text-tertiary">{c.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════ CLI REFERENCE ═══════════════════════ */}
        <section id="cli-reference" className="mt-16 scroll-mt-20">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded border border-white/[0.08] bg-white/[0.03]">
              <Terminal className="size-3 text-text-secondary" />
            </span>
            <p className="text-xs font-medium text-text-tertiary">CLI Reference</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Python SDK &amp; CLI
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-tertiary">
            The <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">tenxo</code> Python package handles encryption, key exchange,
            and job submission from the command line.
          </p>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Installation</h3>
              <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-4">
                <pre className="text-[11px] leading-relaxed text-text-secondary font-mono">pip install tenxo</pre>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">Available commands</h3>
              <div className="mt-2 rounded-xl border border-white/[0.08]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Command</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["tenxo run <file>", "Encrypt and submit a job to the grid"],
                      ["tenxo status <job_id>", "Check the status of a submitted job"],
                      ["tenxo download <job_id>", "Download and decrypt job results"],
                      ["tenxo list", "List all your active and completed jobs"],
                      ["tenxo config set --key <key>", "Set your API key for authentication"],
                      ["tenxo nodes", "List available GPU nodes on the grid"],
                    ].map(([cmd, desc]) => (
                      <tr key={cmd} className="border-b border-white/[0.03] last:border-0">
                        <td className="px-5 py-3 font-mono text-[12px] text-text-secondary">{cmd}</td>
                        <td className="px-5 py-3 text-xs text-text-tertiary">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">Example workflow</h3>
              <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-4">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-text-secondary font-mono">{
`# Authenticate
tenxo config set --key txn_your_api_key_here

# Submit a fine-tuning job
tenxo run model.tar.gz --gpu a5000 --watch

# List available GPUs
tenxo nodes

# Download results
tenxo download job-a1b2c3d4`}</pre>
              </div>
            </div>
          </div>
        </section>


        {/* ═══════════════════ API REFERENCE ═══════════════════════ */}
        <section id="api-reference" className="mt-16 scroll-mt-20">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded border border-white/[0.08] bg-white/[0.03]">
              <BookOpen className="size-3 text-text-secondary" />
            </span>
            <p className="text-xs font-medium text-text-tertiary">API Reference</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            REST endpoint reference
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-tertiary">
            All authenticated endpoints require a <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">Bearer</code> token
            (Supabase JWT or <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]">txn_</code> API key) in the
            <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px]"> Authorization</code> header.
          </p>

          <div className="mt-6 space-y-6">
            {/* Auth */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <KeyRound className="size-3.5 text-text-secondary" />
                Authentication
              </h3>
              <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Method</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Endpoint</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["GET", "/api/keys", "List API keys (auto-generates first key)"],
                      ["DELETE", "/api/keys/:hash", "Revoke an API key"],
                      ["PATCH", "/api/keys/:hash", "Rename an API key"],
                    ].map(([method, endpoint, desc]) => (
                      <tr key={endpoint} className="border-b border-white/[0.03] last:border-0">
                        <td className="px-5 py-3"><span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                          method === "GET" ? "bg-emerald-500/10 text-emerald-400" :
                          method === "POST" ? "bg-blue-500/10 text-blue-400" :
                          method === "DELETE" ? "bg-red-500/10 text-red-400" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>{method}</span></td>
                        <td className="px-5 py-3 font-mono text-[12px] text-text-secondary">{endpoint}</td>
                        <td className="px-5 py-3 text-xs text-text-tertiary">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Jobs */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Cpu className="size-3.5 text-text-secondary" />
                Jobs &amp; compute
              </h3>
              <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Method</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Endpoint</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["POST", "/presign", "Create a presigned upload URL and job ID"],
                      ["GET", "/jobs/:id", "Get job status and result URL"],
                      ["GET", "/nodes", "List all available GPU nodes"],
                      ["GET", "/my-nodes", "List provider's own registered nodes"],
                      ["POST", "/jobs", "Submit a job for execution"],
                    ].map(([method, endpoint, desc]) => (
                      <tr key={endpoint} className="border-b border-white/[0.03] last:border-0">
                        <td className="px-5 py-3"><span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                          method === "GET" ? "bg-emerald-500/10 text-emerald-400" :
                          method === "POST" ? "bg-blue-500/10 text-blue-400" : ""
                        }`}>{method}</span></td>
                        <td className="px-5 py-3 font-mono text-[12px] text-text-secondary">{endpoint}</td>
                        <td className="px-5 py-3 text-xs text-text-tertiary">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Billing */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Wallet className="size-3.5 text-text-secondary" />
                Billing
              </h3>
              <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Method</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Endpoint</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["POST", "/billing/setup-intent", "Create a Razorpay order for adding credits"],
                      ["POST", "/billing/verify-payment", "Verify payment and save payment token"],
                      ["POST", "/billing/charge", "Charge saved payment method"],
                      ["GET", "/billing/usage", "Get current billing usage and balance"],
                    ].map(([method, endpoint, desc]) => (
                      <tr key={endpoint} className="border-b border-white/[0.03] last:border-0">
                        <td className="px-5 py-3"><span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                          method === "GET" ? "bg-emerald-500/10 text-emerald-400" :
                          method === "POST" ? "bg-blue-500/10 text-blue-400" : ""
                        }`}>{method}</span></td>
                        <td className="px-5 py-3 font-mono text-[12px] text-text-secondary">{endpoint}</td>
                        <td className="px-5 py-3 text-xs text-text-tertiary">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ TROUBLESHOOTING ═══════════════════════ */}
        <section id="troubleshooting" className="mt-16 scroll-mt-20">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded border border-white/[0.08] bg-white/[0.03]">
              <ShieldCheck className="size-3 text-text-secondary" />
            </span>
            <p className="text-xs font-medium text-text-tertiary">Troubleshooting</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Common issues &amp; solutions
          </h2>

          <div className="mt-8 space-y-4">
            {[
              {
                q: "Agent won't connect — 'unauthorized' error",
                a: "Verify your user ID is correct. Find it in the Provider Console after signing in. Provider accounts use your Supabase user ID.",
              },
              {
                q: "Node shows 'unverified' TEE status",
                a: "TEE attestation is optional. Nodes without AMD SEV-SNP or Intel TDX hardware run as 'Unverified' — jobs still execute. To enable attestation, ensure /dev/sev-guest is accessible (requires kernel support).",
              },
              {
                q: "Job stuck in 'created' status",
                a: "No available GPU node matched your job requirements. Check /nodes to see current supply. Try a different GPU tier (e.g., RTX 4090 instead of A100).",
              },
              {
                q: "Billing charge failed",
                a: "Ensure your Razorpay payment method has sufficient funds. Pre-paid credits are deducted per-second. If auto-charge fails, add credits manually in the billing settings.",
              },
              {
                q: "API key not working",
                a: "API keys are auto-generated on first visit to the Developer Console. If revoked, a new key is generated on your next API request. Make sure you're using the txn_ prefix.",
              },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl border border-white/[0.08] bg-[#0c0c0d]">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-white">
                  {item.q}
                  <svg className="size-4 shrink-0 text-text-tertiary transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </summary>
                <div className="border-t border-white/[0.08] px-5 py-4">
                  <p className="text-sm leading-relaxed text-text-tertiary">{item.a}</p>
                </div>
              </details>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-white/[0.08] bg-[#0c0c0d] p-6 text-center">
            <h3 className="text-base font-semibold text-white">Still need help?</h3>
            <p className="mt-2 text-sm text-text-tertiary">
              Open an issue on{" "}
              <a href="https://github.com/anomalyco/GPU_grid/issues" className="text-accent-purple hover:text-accent-neon">GitHub</a>{" "}
              or reach out to the team.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <a href="https://github.com/anomalyco/GPU_grid" className="rounded-md bg-zinc-100 px-4 py-2 text-[13px] font-medium text-black hover:bg-white">
                View on GitHub
              </a>
              <a href="/" className="rounded-md border border-white/10 px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-white/5">
                Back to home
              </a>
            </div>
          </div>
        </section>

        {/* ── Bottom spacing ── */}
        <div className="h-24" />
      </div>
    </div>
  );
}
