import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ClientShell } from "./client-shell";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = "https://tenxo.ai";

export const metadata: Metadata = {
  title: "Tenxo — Decentralized GPU Infrastructure",
  description:
    "Decentralized GPU compute secured by TEE. Deploy AI workloads on idle GPUs across a zero-trust peer-to-peer grid at up to 50% less than centralized clouds.",
  metadataBase: new URL(siteUrl),
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Tenxo",
    title: "Tenxo — Decentralized GPU Infrastructure",
    description:
      "Deploy AI workloads on idle GPUs across a zero-trust peer-to-peer grid at up to 50% less than centralized clouds.",
    url: siteUrl,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Tenxo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tenxo — Decentralized GPU Infrastructure",
    description:
      "Deploy AI workloads on idle GPUs across a zero-trust peer-to-peer grid at up to 50% less than centralized clouds.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Tenxo",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Linux, macOS, Windows",
  description:
    "Decentralized GPU compute secured by TEE. Deploy AI workloads on idle GPUs across a zero-trust peer-to-peer grid.",
  url: siteUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <link rel="canonical" href={siteUrl} />
      </head>
      <Script
        id="schema-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
