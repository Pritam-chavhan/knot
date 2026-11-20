import type { Metadata, Viewport } from "next";
import { inter, serif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "KNOT",
  description: "Know what's on. Meet who's going. For IIT Gandhinagar students.",
  applicationName: "KNOT",
  appleWebApp: { capable: true, title: "KNOT", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
