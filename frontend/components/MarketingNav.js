import Link from "next/link";
import { Network } from "lucide-react";

export default function MarketingNav({ onSignIn }) {
  const links = [
    ["Product", "/features"],
    ["Providers", "/providers"],
    ["Pricing", "/pricing"],
    ["Docs", "/docs"],
  ];

  return (
    <header className="marketing-nav">
      <Link href="/" className="marketing-brand" aria-label="Tenxo home">
        <span className="marketing-brand-mark">
          <Network size={17} />
        </span>
        <span>tenxo</span>
      </Link>

      <nav className="marketing-pill-nav" aria-label="Primary navigation">
        {links.map(([label, href]) => (
          <Link key={label} href={href}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="marketing-actions">
        <a href="mailto:founders@tenxo.ai" className="hidden text-sm text-[var(--text-muted)] transition hover:text-white sm:inline">
          Contact
        </a>
        <button onClick={onSignIn} className="marketing-signin">
          Sign in
        </button>
        <button onClick={onSignIn} className="marketing-signup">
          Sign up
        </button>
      </div>
    </header>
  );
}
