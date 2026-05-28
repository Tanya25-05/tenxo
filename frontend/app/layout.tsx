import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientShell } from "./client-shell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tenxo — Decentralized GPU Infrastructure",
  description:
    "Decentralized GPU compute secured by TEE. Deploy AI workloads on idle GPUs across a zero-trust peer-to-peer grid at up to 50% less than centralized clouds.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
