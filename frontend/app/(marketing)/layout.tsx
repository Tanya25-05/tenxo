import Link from "next/link";

const navLinks = [
  { href: "/features", label: "Product" },
  { href: "/providers", label: "Providers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#09090b]">
            T
          </span>
          <span className="text-sm font-semibold tracking-tight">tenxo</span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#09090b] transition-colors hover:bg-white/90"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-12 flex items-start justify-between gap-8">
          <div className="max-w-xs">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#09090b]">
                T
              </span>
              <span className="text-sm font-semibold tracking-tight">tenxo</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500">
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
                  ["Developer", "/app/developer"],
                  ["Provider", "/app/provider"],
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
                <h4 className="mb-3 text-xs font-semibold text-gray-300">
                  {col.title}
                </h4>
                <ul className="space-y-2">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-xs text-gray-500 transition-colors hover:text-gray-200"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-6 text-[11px] text-gray-600">
          <span>Tenxo Compute Grid</span>
          <span>Secure peer-to-peer GPU infrastructure</span>
        </div>
      </div>
    </footer>
  );
}
