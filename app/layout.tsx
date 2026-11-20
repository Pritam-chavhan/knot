import type { Metadata, Viewport } from "next";
import { display, sans } from "./fonts";
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
  themeColor: "#f2f3f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
