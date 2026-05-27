import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tenxo — Decentralized GPU Infrastructure",
  description:
    "Network idle distributed GPUs into a secure compute grid for AI training, fine-tuning, and inference at up to 50% less than centralized clouds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-[#09090b] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
