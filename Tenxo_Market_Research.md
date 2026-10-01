# Tenxo — Market Research Report
## Decentralized GPU Compute Landscape (May 2026)

---

## 1. GPU Compute Market: The Big Picture

### Market Size & Growth

| Metric | Value | Source |
|--------|-------|--------|
| Global GPU market (2026) | **$100-104B** | Mordor Intelligence, Fortune BI |
| Global GPU market (2034) | **$642B** (26.1% CAGR) | Fortune Business Insights |
| AI data center GPU market (2026) | **$27.9B** | Precedence Research |
| AI data center GPU market (2030) | **$228B** (13.7% CAGR) | MarketsandMarkets |
| NVIDIA data center revenue (FY2026E) | **$150B+** | Silicon Analysts |
| Decentralized compute market (2026) | **$8.9B** (25.7% CAGR) | TBRC |
| Decentralized compute market (2030) | **$22.5B** | TBRC |
| Decentralized GPU annualized protocol revenue | **$200M+** (early 2026) | DeFiLlama, Dune Analytics |
| DePIN sector market cap | **$9.4B** (Mar 2026, peak $19.2B in Sep 2025) | CoinGecko |

### Key Observations

1. **NVIDIA dominates** ~80-90% of AI accelerators. Their data center revenue grew from $15B (2022) to $130B+ (2025E). Even as share declines to ~75% by 2026, absolute revenue keeps growing because the market expands faster than competitors can capture share.

2. **Inference > Training** — The AI inference market is the largest and fastest-growing segment. Most decentralized networks target inference, not training, because inference is highly parallelizable and latency-tolerant.

3. **The GPU shortage is structural** — AWS H100 clusters had 8-12 month waitlists in 2023-2024. Cloud providers raised AI compute prices 40-60% in 2025. McKinsey estimates the global AI infrastructure market will surpass **$700B annually by 2030**.

4. **Cost differential is massive** — Decentralized GPU networks offer **60-90% cost savings** vs AWS/Azure comparable instances. Akash settles at 80-90% below AWS for CPU; Render benchmarks ~70% below Azure ML compute.

---

## 2. The Decentralized GPU Competitor Landscape

### Tier 1: The "Big Three" DePIN Compute Networks

#### Render Network (RENDER)

| Dimension | Detail |
|-----------|--------|
| **Founded** | 2017 (Ethereum), migrated to Solana 2023-2024 |
| **Market Cap** | ~$700M - $1.5B (varies) |
| **Core Focus** | GPU rendering → expanded to AI inference |
| **Revenue Model** | Burn-Mint Equilibrium (95% of job spend burned) |
| **2025 Revenue** | Not publicly disclosed |
| **Strengths** | Longest track record, real enterprise customers (Pixar, HBO, Apple via OTOY), verified job results |
| **Weaknesses** | Permissioned onboarding (Foundation approval required), still rendering-heavy, opaque pricing |
| **Security** | No TEE/confidential compute in production. Relies on reputation-based node selection (Tier 1/2/3). Node operators must be approved by Foundation. Job verification is about *output quality* (render correctness), not *privacy*. |
| **Crypto Mining Prevention** | **None publicly documented.** Permissioned onboarding acts as a soft barrier — Foundation can deny known mining operations. However, no runtime detection exists. Nodes run arbitrary GPU workloads. |
| **Notable** | Launched Dispersed.com (Dec 2025) — AI compute subnet with 600+ models at $1.75/hr. Node operators must be approved by the Render Foundation. |

#### Akash Network (AKT)

| Dimension | Detail |
|-----------|--------|
| **Founded** | 2018 (Cosmos SDK) |
| **Market Cap** | ~$88M - $146M |
| **Core Focus** | General-purpose decentralized cloud (CPU + GPU + storage) |
| **Revenue Model** | Burn-Mint Equilibrium (activated Mar 2026) + take fee on deployment spend |
| **2025 Revenue** | $3.15M (on-chain audited, 128% YoY growth). Q1 2026 ATH: $5M |
| **Strengths** | Permissionless, open-source (Apache 2.0), verifiable revenue, Kubernetes-native, reverse auction drives lowest prices |
| **Weaknesses** | Supply inconsistency, no SLAs, general-purpose means not optimized for AI |
| **Security** | **Most advanced in TEE.** AEP-83/Kata Containers: confidential computing via Intel TDX + AMD SEV-SNP + NVIDIA H100 CC mode. Composite attestation (CPU + GPU). Still in roadmap/proposal stage (AEP-65, AEP-83). Not fully deployed in production yet. |
| **Crypto Mining Prevention** | **None explicit.** Relies on marketplace dynamics (providers compete on price; miners would be outbid by serious providers) + reputation system. No workload inspection. Permissionless means *anyone* can join. |
| **Notable** | Starcluster initiative — acquiring ~7,200 NVIDIA GB200 GPUs for enterprise-grade "planetary mesh." Planning to migrate off Cosmos SDK by late 2026. |

#### io.net (IO)

| Dimension | Detail |
|-----------|--------|
| **Founded** | 2022 (Solana) |
| **Market Cap** | ~$32M - $400M+ (peak during growth cycle) |
| **Core Focus** | AI GPU aggregation (training + inference) |
| **Revenue Model** | Incentive Dynamic Engine (IDE) launching Q2 2026 |
| **2025 Revenue** | ~$12.5M annualized (self-reported, partially verified) |
| **Strengths** | Largest GPU pool (claims 100K+ devices), AI-optimized clustering, low cost (90% below cloud), enterprise partnerships (Dell, KREA/Nike, UC Berkeley) |
| **Weaknesses** | Sybil attack history (1.8M fake GPUs in 2024), only ~6,720 daily verified active, self-reported revenue, verification gap |
| **Security** | **No TEE support documented.** Uses "proof-of-work" mechanism to verify GPUs are online (cryptographic verification tasks), but this is for *availability verification*, not *privacy*. No confidential compute. |
| **Crypto Mining Prevention** | **None documented.** In fact, io.net *explicitly aggregates GPUs from crypto mining farms* transitioning away from PoW mining. This is a feature, not a bug — mining farms are a major supply source. Their "proof-of-work" verification mechanism only checks that a GPU is present and responding, not what it's running. |
| **Notable** | Biggest hype-to-reality gap. P/Revenue ~2.6x (market is skeptical). Joined Dell partner program (Dec 2024). |

### Tier 2: Centralized GPU Marketplace Competitors

These are not "decentralized" in the blockchain sense — they are centralized platforms that aggregate GPU supply from datacenters and individuals. They are Tenxo's competition for *developer mindshare and GPU supply*.

#### RunPod

| Dimension | Detail |
|-----------|--------|
| **Founded** | 2020 (US) |
| **Business Model** | Centralized GPU cloud — two tiers: Secure Cloud (T3/T4 datacenters, SLA) + Community Cloud (peer-to-peer hosts, no SLA) + Serverless (scale-to-zero inference) |
| **ARR (2026)** | **~$120M** (90% YoY growth, only $20M raised — extremely capital efficient) |
| **Funding** | Intel Capital, Dell Technologies Capital (strategic). A16z Speedrun default GPU infra partner |
| **GPU Catalog** | 18+ GPU classes: RTX 4090/5090 → H100/H200/B200. Consumer to enterprise |
| **Pricing** | RTX 4090: $0.34/hr (Community), H100: $1.99-2.79/hr, A100: $1.19/hr. Per-second billing |
| **Differentiator** | Best balance of price + usability. Docker-native, sub-200ms cold starts on Serverless, template ecosystem |
| **Security** | SOC 2 Type II (Oct 2025), HIPAA, GDPR. **No TEE/confidential compute.** Workloads run in plaintext in Docker containers. Community Cloud hosts are not audited — data could be observed by host operator. |
| **Crypto Mining Prevention** | **None for Community Cloud.** Community Cloud is peer-to-peer (like Vast.ai) — hosts are vetted but not monitored for workload type. Secure Cloud is datacenter-only with contractual prohibitions. The platform has no runtime workload detection. |
| **Multi-Node** | Instant Clusters (up to 8 GPUs on one host). No multi-host InfiniBand clustering |
| **Strengths** | Massive GPU selection, excellent developer experience, per-second billing, SOC 2 certified, template library (1-click deploy popular models), serverless auto-scaling |
| **Weaknesses** | Community Cloud availability is spiky (capacity exhausts in peak hours). No multi-node training at scale. Community Cloud reliability varies. No privacy guarantees for workloads. |
| **Strategic Note** | RunPod is Tenxo's most relevant "traditional" competitor because they bridge the gap between hyperscaler and p2p. They are the default choice for AI devs who want cheap GPUs without dealing with crypto. **Their weakness: no privacy.** Every workload runs in plaintext visible to the host. |

#### Vast.ai

| Dimension | Detail |
|-----------|--------|
| **Founded** | 2018 (Los Angeles) |
| **Business Model** | Peer-to-peer GPU marketplace. Individual hosts (gamers, ex-miners, small colo) list GPUs. Vast takes ~25-30% commission. **Pure marketplace — no owned infrastructure** |
| **ARR (2026)** | ~$2.2M (Vast's platform revenue; underlying GMV is much higher since this is commission-only) |
| **Funding** | ~$4M from DRW Holdings, Nazare. **Largely bootstrapped** |
| **GPU Catalog** | **68+ GPU classes** — largest selection in market. RTX 3060 → B300 SXM. 17,000+ GPUs across 1,400+ providers in 500+ locations |
| **Pricing** | **Cheapest in market.** RTX 4090: ~$0.20-0.35/hr (vs RunPod $0.34), A100 80GB: ~$0.67-1.00/hr, H100: ~$0.90-1.87/hr. Per-second billing. Lower than all competitors by 30-60% |
| **Differentiator** | Absolute lowest price. Largest consumer GPU selection. Marketplace dynamics drive prices below fixed providers |
| **Security** | SOC 2 Type II, HIPAA, GDPR (on Secure Cloud tier). **No TEE.** "Verified hosts" have reliability scores and benchmarks. **Fundamental trust problem:** you're renting someone's personal machine — host has physical access, your data runs in plaintext in Docker. |
| **Crypto Mining Prevention** | **None.** In fact, ex-crypto-miners are a major supply source. The platform embraces this. No workload inspection. Host reliability scores help but don't detect mining. |
| **Multi-Node** | Single-host only. **No native multi-host clustering.** Cannot do distributed training across machines |
| **Strengths** | Lowest prices in the market by significant margin. Widest GPU selection (especially consumer GPUs). Per-second billing. Spot/interruptible bidding for 50%+ discounts |
| **Weaknesses** | Reliability varies wildly by host (residential internet drops kill jobs). No formal support (Discord/email only). Complex UI. No SLA. Security/compliance is the weakest of any major provider — your code runs on a stranger's machine in plaintext. |
| **Strategic Note** | Vast.ai demonstrates that **there IS massive untapped consumer GPU supply** — their 17,000+ GPUs from 1,400+ hosts proves the thesis. But their model has no privacy at all. Tenxo can go after the same supply with the differentiator of "your code stays encrypted." Vast.ai also shows that pure marketplace models suffer from reliability problems that turn off serious AI teams. |

#### Comparison: RunPod vs Vast.ai vs Tenxo

| Feature | Tenxo | RunPod | Vast.ai |
|---------|-------|--------|---------|
| **Category** | Decentralized (ZK) | Centralized (hybrid) | Centralized (P2P) |
| **Privacy** | ✅ TEE + ZK routing | ❌ Plaintext Docker | ❌ Plaintext Docker |
| **Consumer GPUs** | ✅ (RTX 4090, etc.) | ✅ (Community tier) | ✅ (68+ classes) |
| **Enterprise GPUs** | Planned | ✅ (Secure Cloud H100/B200) | ✅ (via verified hosts) |
| **Fiat Payments** | ✅ | ✅ | ✅ |
| **Pricing (RTX 4090)** | $0.15/hr | $0.34/hr (Community) | $0.20-0.35/hr |
| **Pricing (H100)** | $0.75/hr | $1.99-2.79/hr | $0.90-1.87/hr |
| **Reliability** | TEE-verified | High (Secure) / Variable (Community) | Variable (by host) |
| **Security Cert** | None yet | SOC 2, HIPAA, GDPR | SOC 2, HIPAA, GDPR |
| **Multi-Node** | Planned | Up to 8 GPU | None |
| **Revenue** | Pre-revenue | ~$120M ARR | ~$2.2M ARR (commission) |
| **Mining Prevention** | None yet | None | None (embraces miners) |

### Tier 3: Specialized / Emerging Players

#### Aethir

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | Enterprise GPU for cloud gaming + AI training |
| **Revenue** | ~$150M annualized (Q3 2025: $39.8M quarterly). **Largest in sector.** |
| **Key Strength** | Enterprise SLAs, 150+ paying enterprise clients |
| **Security** | No public TEE/confidential compute documentation. Enterprise focus suggests contractual security, not cryptographic. |
| **Crypto Mining** | Not addressed publicly. Enterprise SLAs would prohibit mining, but enforcement is contractual. |
| **Platform** | Arbitrum-based |

#### Gensyn

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | Decentralized AI *training* (not inference) with cryptographic verification |
| **Key Innovation** | "Proof-of-Learning" — cryptographically verify that training actually happened |
| **Backing** | a16z ($43M Series A) |
| **Status** | Token launched 2026; market cap ~$71M circulating, $546M FDV |
| **Security** | Groundbreaking approach: uses cryptographic proofs to verify *computation correctness*, not hardware TEEs. Different trust model — you can prove training was done correctly without trusting hardware. |
| **Crypto Mining** | Proof-of-Learning would theoretically detect mining since the cryptographic proof wouldn't match expected training computation. But this is unproven at scale. |

#### Hyperbolic

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | AI inference at 75% below cloud |
| **Key Metric** | Powers 100,000+ developers |
| **Architecture** | Hyper-dOS — decentralized operating system for GPU orchestration |
| **Security** | Planning "cryptographic verification" but not yet deployed |

#### Nosana (NOS)

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | AI inference at the edge (low-latency) |
| **Platform** | Solana-based |
| **Niche** | Latency-sensitive AI applications |
| **Security** | No public TEE documentation |

#### Flux / FluxCloud

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | Full-stack decentralized cloud (CPU + GPU + storage + apps) |
| **Differentiator** | "Platform supply" vs just "compute supply" — provides runtime environments, not just raw GPU |
| **Security** | No TEE documented. Competes on completeness of platform, not privacy guarantees. |

#### Cocoon (TON-based)

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | Decentralized AI inference with TEE privacy |
| **Architecture** | RA-TLS encrypted connections, TEE attestation (Intel TDX), on-chain registries |
| **Security** | **TEE-first design.** Uses Intel TDX for both proxy and worker nodes. On-chain image hash registry for verification. GPU verification on boot (fail-closed). |
| **Crypto Mining** | Not documented. TEE-based design would technically make it hard to mine (mining software might not run in TDX), but this is incidental. |

#### Cerumbra

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | End-to-end encrypted browser-to-TEE GPU inference |
| **Architecture** | Browser ECDH → AES-GCM → NVIDIA H100 TEE / Blackwell TEE |
| **Status** | Pre-production — waiting for H100 TEE hardware availability |
| **Security** | **Deepest TEE integration.** Protocol-level encryption from browser to GPU. Remote attestation with full certificate chain verification. |
| **Crypto Mining** | Natural prevention: mining workloads can't run in NVIDIA H100 TEE (designed for inference only). |

#### Phala Network

| Dimension | Detail |
|-----------|--------|
| **Core Focus** | TEE-based confidential computing for blockchain + AI |
| **Key Innovation** | "Private ML SDK" — turn Docker workflows into TEE-protected deployments |
| **Security** | **Most advanced TEE implementation.** Intel SGX → TDX + AMD SEV-SNP + NVIDIA H100 GPU TEE. On-chain attestation anchoring. Composite CPU+GPU attestation. |
| **Crypto Mining** | Not explicitly addressed. TEE architecture inherently restricts what can run (signed measurements). Mining software wouldn't match expected measurements. |

---

### Competitive Matrix Summary (Full Market)

| Feature | Tenxo | RunPod | Vast.ai | Render | Akash | io.net | Aethir |
|---------|-------|--------|---------|--------|-------|--------|--------|
| **Category** | Decentralized ZK | Centralized hybrid | Centralized P2P | DePIN | DePIN | DePIN | DePIN |
| **Consumer GPUs** | ✅ | ✅ (Community) | ✅ (68+ classes) | ✅ | ✅ | ✅ | ❌ |
| **Enterprise GPUs** | Planned | ✅ (Secure Cloud) | ✅ (verified hosts) | ✅ | ✅ (Starcluster) | ✅ | ✅ |
| **Fiat Payments** | ✅ | ✅ | ✅ | ❌ (crypto) | ❌ (crypto) | ❌ (crypto) | ❌ (crypto) |
| **TEE / Privacy** | ✅ SEV-SNP | ❌ plaintext | ❌ plaintext | ❌ no TEE | ⏳ roadmap | ❌ no TEE | ❌ no TEE |
| **ZK Routing** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Revenue (2025)** | Pre-revenue | ~$120M ARR | ~$2.2M ARR* | Undisclosed | $3.15M | $12.5M (claimed) | ~$150M |
| **Security Cert** | None yet | SOC 2, HIPAA, GDPR | SOC 2, HIPAA, GDPR | None | None | None | None |
| **Multi-Node** | Planned | Up to 8 GPU | None | ✅ | ✅ (Starcluster) | ✅ (clusters) | ✅ |
| **Mining Prev.** | None yet | None | None (embraces) | Permissioned gate | Marketplace | Feature (farms) | Contractual |

*\* Vast.ai ARR is commission-only; underlying GMV is much higher.*

**What this tells you:** Tenxo is the *only* platform offering privacy + fiat + consumer GPUs in one package. RunPod and Vast.ai have the revenue and the supply but zero privacy guarantees. The DePIN competitors have blockchain but no privacy (except Akash on roadmap). Tenxo's window is the gap between "developers want cheap compute" and "developers need their code to not leak."

---

## 3. Security & Privacy: How Competitors Handle It

### The Spectrum of Approaches

```
No Privacy                     Full Privacy
    |                            |
    v                            v
  io.net    Render    Akash (planned)    Cocoon    Tenxo    Cerumbra    Phala
  (none)   (reputation) (TEE roadmap)   (TDX)   (SEV-SNP)  (H100 TEE) (Multi-TEE)
```

### Key Findings

1. **Most competitors have NO privacy guarantees.** io.net, Render, and Aethir run workloads in plaintext on untrusted machines. Privacy is not part of their value prop.

2. **Akash is moving toward TEE** but it's still on the roadmap (AEP-65, AEP-83). Kata Containers with Intel TDX + AMD SEV-SNP + NVIDIA H100 CC-mode. Not deployed in production yet.

3. **TEE-first projects exist but are pre-production.** Cocoon, Cerumbra, and Phala have the right architecture but lack network effects, supply, or production readiness. Phala is the most advanced but uses Intel SGX (limited memory, 128MB enclaves) which severely limits AI workloads.

4. **Gensyn takes a unique approach** — cryptographic "Proof-of-Learning" instead of hardware TEEs. This is academically interesting but unproven at scale. No production benchmarks exist.

5. **TEE hardware availability is a bottleneck** — NVIDIA H100/H200 confidential compute mode requires specific firmware and is only available on the newest hardware. AMD SEV-SNP is more widely available on EPYC CPUs. Tenxo's choice of AMD SEV-SNP is pragmatic — more existing infrastructure supports it.

### Tenxo's Position

Tenxo is **the only production-ready platform combining all three**:
- ✅ TEE attestation (AMD SEV-SNP, working today)
- ✅ Zero-knowledge routing (matchmaker never sees plaintext)
- ✅ Consumer GPU support (RTX 4090, etc.)
- ✅ Fiat payments (Razorpay, no crypto)

vs Akash (TEE on roadmap, crypto-only) vs Render (no TEE, crypto-only, permissioned) vs io.net (no TEE, crypto-only, supply quality issues)

---

## 4. Crypto Mining Abuse: How Competitors Handle It

This is the question you asked earlier. Here's the honest state of the industry:

### Nobody Has a Good Answer

| Competitor | Approach | Effectiveness |
|-----------|----------|--------------|
| **io.net** | **Mining farms are a feature.** They explicitly aggregate GPUs from crypto mining operations. Their "proof-of-work" verification only checks GPU availability. | Not prevention — supply source |
| **Render** | Permissioned onboarding — Foundation must approve nodes. Soft barrier but runtime detection doesn't exist. | Low (rejects known miners only) |
| **Akash** | Marketplace dynamics + reputation. Permissionless — anyone can join. No workload inspection. | Low (miners just need to bid competitively) |
| **Aethir** | Enterprise SLAs — contractual prohibition. Enforcement is legal, not technical. | Moderate (contractual only) |
| **Gensyn** | Proof-of-Learning would theoretically detect non-training workloads. | Untested at scale |
| **Phala / Cocoon / Cerumbra** | TEE-restricted execution — only signed/measured workloads can run. | High (mining software wouldn't match expected measurements) |
| **Tenxo** | **Currently none** (same as most competitors) | N/A |

### What Actually Works

1. **TEE-restricted execution** (Phala model) — Only workloads whose measurements match expected values can run. Mining software would fail attestation. **Downside:** requires curated image registry, limits flexibility.

2. **GPU profiling** (proposed for Tenxo) — Monitor utilization patterns. Mining: flat 100%, predictable memory. ML: bursty, variable memory, I/O wait. **Cheap, effective for naive miners.**

3. **Financial barriers** (Tenxo's current approach) — Prepaid credits ($5 minimum). Wallets are authenticated. Mining may not be profitable at $0.15/hr RTX 4090 pricing vs cloud GPU mining alternatives.

4. **Output heuristics** — Check result sizes, file types for known mining artifacts (wallet files, DAG files). **Metadata only, no plaintext exposure.**

5. **Reputation & staking** — Providers stake tokens. If mining detected, stake is slashed. **Requires tokenomics (Tenxo is fiat-only).**

### Honest Assessment

**No decentralized GPU network has solved this problem.** The fundamental tension is:
- Zero-knowledge means the platform *can't* inspect workloads
- Preventing abuse requires *some* inspection

The industry consensus is that **pricing arbitrage + financial barriers + reputation systems** are sufficient for MVP. Mining at decentralized GPU prices ($0.15-0.50/hr for consumer GPUs) is less profitable than dedicated mining on ASICs or cloud GPU mining at scale. The risk is real but manageable.

Tenxo's proposed layered approach (profiling → heuristics → staking) would be **more comprehensive than most competitors** while preserving the zero-knowledge architecture.

---

## 5. Strategic Insights for Tenxo

### What Competitors Get Wrong

1. **Crypto-only payments** — Every major competitor forces users to hold volatile tokens. This limits adoption to crypto-native users. Tenxo's fiat-only approach (Razorpay) addresses the **real** market: AI developers who don't want to touch crypto.

2. **No privacy guarantees** — io.net, Render, and Akash run code in plaintext. The #1 question from enterprise AI teams is "will my model weights leak?" Tenxo can answer "no, they're encrypted end-to-end and run in a TEE." This is a **massive differentiator.**

3. **Permissioned or permissionless extremes** — Render is too centralized (Foundation approval). Akash is too chaotic (anyone can join, inconsistent quality). Tenxo's model (permissionless for supply, TEE-verified execution) offers the best balance.

4. **GPU supply quality** — io.net's Sybil attack showed the problem with unverified supply. Tenxo's TEE attestation + zero-knowledge routing means **providers can't fake their hardware** and **can't steal your data.**

### What Tenxo Should Watch

1. **NVIDIA's response** — If NVIDIA launches a decentralized compute product (unlikely but possible), it could reshape the market given their ~80% market share.

2. **Akash's TEE rollout** — If Akash successfully deploys Kata Containers + TEE, they eliminate Tenxo's privacy advantage. But they'd still require crypto tokens.

3. **Enterprise adoption timing** — The market isn't asking for decentralized compute yet. AI startups are *desperate* for cheap compute and will sacrifice privacy for cost. Tenxo needs to compete on price first, privacy second.

4. **Supply-side chicken-and-egg** — Without GPU providers, there's no compute to sell. Without compute, there are no developers. The installer script + TEE attestation makes joining as a provider easy, but Tenxo needs a critical mass of GPUs to be useful.

### Tenxo's Unique Value Proposition

```
Property          Tenxo    Competitors
───────           ─────    ───────────
Privacy           ✅        ❌ (mostly)
Consumer GPUs     ✅        ✅ (some)
Fiat payments     ✅        ❌ (all crypto)
TEE verified      ✅        ❌ (mostly not)
Open source       Partial  ✅/❌ mixed
Production        ✅ MVP   ✅ (some)
```

The **unbeatable combination** is: **Pay with a credit card, your code stays private, it runs on cheap consumer GPUs, and you can verify it happened correctly.** No competitor offers this package today.

---

*Research compiled May 2026. Sources: CoinGecko, DeFiLlama, Messari, Dune Analytics, project documentation, market research reports from Fortune BI, Mordor Intelligence, MarketsandMarkets, Precedence Research, TBRC, Grand View Research.*
