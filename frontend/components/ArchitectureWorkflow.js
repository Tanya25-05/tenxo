import { Cpu, KeyRound, Layers3, Server, Wallet } from "lucide-react";

const steps = [
  {
    icon: Server,
    title: "Providers connect GPUs",
    text: "A host installs the lightweight worker, authenticates with Tenxo, and publishes heartbeat-backed availability.",
    meta: "HOST",
  },
  {
    icon: KeyRound,
    title: "Matchmaker verifies supply",
    text: "The Go API receives signed worker updates and exposes only authenticated idle GPUs to the marketplace.",
    meta: "AUTH",
  },
  {
    icon: Cpu,
    title: "Developers choose compute",
    text: "AI teams pick a GPU tier, deploy pods, and start work against live capacity without cloud reservation overhead.",
    meta: "GPU",
  },
  {
    icon: Layers3,
    title: "Runtime is measured",
    text: "Tenxo tracks active compute time so usage can be priced by the second and rolled into pay-as-you-go billing.",
    meta: "METER",
  },
  {
    icon: Wallet,
    title: "Charges and payouts settle",
    text: "Developers pay for the time they consume while providers earn from verified utilization.",
    meta: "BILL",
  },
];

export default function ArchitectureWorkflow() {
  return (
    <section className="architecture-section">
      <div className="architecture-heading">
        <p className="marketing-kicker">System architecture</p>
        <h2>From idle silicon to billable AI compute</h2>
        <p>
          Tenxo turns a scattered network of GPUs into a single product loop: hosts
          contribute capacity, developers schedule workloads, and usage is metered as it runs.
        </p>
      </div>

      <div className="architecture-timeline">
        {steps.map((step, index) => (
          <article key={step.title} className="architecture-step">
            <div className="architecture-rail">
              <span className={index === 0 ? "architecture-dot architecture-dot-active" : "architecture-dot"} />
            </div>
            <div className="architecture-card">
              <div className="architecture-card-top">
                <step.icon size={18} />
                <span>{step.meta}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
