import localFont from "next/font/local";

// Figtree for reading, Bricolage Grotesque for headlines and numbers.
export const sans = localFont({
  src: [
    { path: "./fonts/figtree.woff2", weight: "300 900", style: "normal" },
    { path: "./fonts/figtree-italic.woff2", weight: "300 900", style: "italic" },
  ],
  variable: "--font-figtree",
  display: "swap",
});

export const display = localFont({
  src: [{ path: "./fonts/bricolage.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-bricolage",
  display: "swap",
});
