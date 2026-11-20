import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { display, sans } from "./fonts";
import "./globals.css";

const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";
const DESCRIPTION = "Every event at IIT Gandhinagar, the people going to it, and an easy way to go together.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "KNOT: know what's on, meet who's going", template: "%s · KNOT" },
  description: DESCRIPTION,
  applicationName: "KNOT",
  appleWebApp: { capable: true, title: "KNOT", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "KNOT",
    title: "KNOT: know what's on, meet who's going",
    description: DESCRIPTION,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f3f7",
};

// Reading headers makes every page render per request, which the nonce-based
// Content Security Policy needs.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
