import { BookOpen, Code2, Cpu, Server } from "lucide-react";
import { Button } from "@/components/Button";

const cards = [
  { icon: BookOpen, title: "Architecture", text: "Supabase sessions protect user access while the Go API coordinates nodes and pods." },
  { icon: Code2, title: "Python CLI", text: "Use authenticated commands to launch workloads and inspect decentralized compute state." },
  { icon: Server, title: "Provider agent", text: "Rust workers register GPU availability and refresh liveness through heartbeats." },
  { icon: Cpu, title: "Developer pods", text: "Deploy jobs against live GPU inventory surfaced from the matchmaker." },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="border-b border-white/[0.06] py-16 sm:py-20">
        <p className="mb-3 text-xs font-medium text-gray-500">Docs</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Tenxo integration map
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">
          A lightweight docs hub for the MVP stack: Next.js console, Supabase auth, Go matchmaker, Rust worker, Python CLI, and R2 artifacts.
        </p>
      </section>

      <section className="grid gap-px py-16 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="border border-white/[0.06] bg-[#0c0c0d] p-6 sm:border-r-0 even:sm:border-r-0 last:sm:border-r">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                <Icon className="size-4 text-gray-300" />
              </div>
              <h2 className="mb-2 text-sm font-semibold text-white">{c.title}</h2>
              <p className="text-xs leading-relaxed text-gray-500">{c.text}</p>
            </div>
          );
        })}
      </section>

      <section className="border-t border-white/[0.06] py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Get started with the docs
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
          Everything you need to integrate with the Tenxo compute grid.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg">Browse docs</Button>
          <Button variant="secondary" size="lg">View on GitHub</Button>
        </div>
      </section>
    </div>
  );
}
