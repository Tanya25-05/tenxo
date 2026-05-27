import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ClientShell } from "./client-shell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tenxo — Decentralized GPU Infrastructure",
  description:
    "Decentralized GPU compute secured by TEE. Deploy AI workloads on idle GPUs across a zero-trust peer-to-peer grid at up to 50% less than centralized clouds.",
};

const navLinks = [
  { href: "/features", label: "Product" },
  { href: "/providers", label: "Providers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <ClientShell>
          <header className="fixed top-0 z-50 h-14 w-full border-b border-white/[0.08] bg-background/70 backdrop-blur-xl">
            <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between px-6">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-white text-[11px] font-bold text-black">
                  T
                </span>
                <span className="text-sm font-semibold tracking-tight text-text-primary">
                  tenxo
                </span>
              </Link>

              <nav className="hidden items-center gap-6 sm:flex">
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
              </div>
            </div>
          </header>

          <main className="pt-14">{children}</main>

          <footer className="border-t border-white/[0.08]">
            <div className="mx-auto max-w-[1100px] px-6 py-12">
              <div className="mb-10 flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xs">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-white text-[11px] font-bold text-black">
                      T
                    </span>
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
        </ClientShell>
      </body>
    </html>
  );
}
