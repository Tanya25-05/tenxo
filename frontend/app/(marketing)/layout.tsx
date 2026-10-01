import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/ui/Logo";

const navLinks = [
  { href: "/features", label: "Product" },
  { href: "/providers", label: "Providers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="fixed top-0 z-50 h-14 w-full border-b border-white/[0.08] bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} className="text-white" />
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              tenxo
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-6 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link
                href="/login"
                className="rounded-md px-4 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-zinc-100 px-4 py-1.5 text-[13px] font-medium text-black transition-all hover:bg-white"
              >
                Open Console
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/developer"
                className="rounded-md px-4 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                Go to console
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="pt-14">{children}</main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto max-w-[1100px] px-6 py-12">
          <div className="mb-10 flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <div className="mb-3 flex items-center gap-2">
                <Logo size={28} className="text-white" />
                <span className="text-sm font-semibold tracking-tight text-text-primary">
                  tenxo
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-text-tertiary">
                Decentralized GPU compute for AI builders and hardware providers.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-12">
              {[
                {
                  title: "Product",
                  links: [
                    ["Features", "/features"],
                    ["Providers", "/providers"],
                    ["Pricing", "/pricing"],
                    ["Docs", "/docs"],
                  ],
                },
                {
                  title: "Console",
                  links: [
                    ["Developer", "/developer"],
                    ["Provider", "/provider"],
                    ["Marketplace", "/marketplace"],
                  ],
                },
                {
                  title: "Resources",
                  links: [
                    ["Architecture", "/features"],
                    ["Host GPUs", "/providers"],
                    ["Pay as you go", "/pricing"],
                  ],
                },
              ].map((col) => (
                <div key={col.title}>
                  <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
                    {col.title}
                  </h4>
                  <ul className="space-y-2">
                    {col.links.map(([label, href]) => (
                      <li key={label as string}>
                        <Link
                          href={href as string}
                          className="text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
                        >
                          {label as string}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-6 text-[12px] text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
            <span>Tenxo Compute Grid</span>
            <span>Secure peer-to-peer GPU infrastructure &middot; Zero-trust by design</span>
          </div>
        </div>
      </footer>
    </>
  );
}
