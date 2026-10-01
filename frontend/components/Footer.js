import React from "react";

export default function Footer() {
  return (
    <footer className="w-full border-t border-white/6 bg-transparent mt-8">
      <div className="max-w-5xl mx-auto py-6 px-4 text-sm text-[var(--text-muted)] flex items-center justify-between">
        <div>© {new Date().getFullYear()} Tenxo — GPU Grid</div>
        <div className="flex items-center gap-4">
          <a href="/docs" className="hover:text-white">
            Docs
          </a>
          <a href="/pricing" className="hover:text-white">
            Pricing
          </a>
        </div>
      </div>
    </footer>
  );
}
