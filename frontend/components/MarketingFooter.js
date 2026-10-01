import Link from "next/link";
import { Network } from "lucide-react";

const columns = [
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
];

export default function MarketingFooter({ onSignIn }) {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-cta">
        <div>
          <p className="marketing-kicker">Start building</p>
          <h2>Compute that follows the shape of your workload.</h2>
        </div>
        <button onClick={onSignIn} className="tenxo-btn-primary">
          Open console
        </button>
      </div>

      <div className="marketing-footer-grid">
        <div className="marketing-footer-brand">
          <span className="marketing-brand-mark">
            <Network size={15} />
          </span>
          <span>tenxo</span>
          <p>
            Decentralized GPU compute for AI builders and hardware providers.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3>{column.title}</h3>
            {column.links.map(([label, href]) => (
              <Link key={label} href={href}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="marketing-footer-bottom">
        <span>Tenxo Compute Grid</span>
        <span>Secure peer-to-peer GPU infrastructure</span>
      </div>
    </footer>
  );
}
