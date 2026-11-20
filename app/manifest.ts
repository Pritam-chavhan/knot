import type { MetadataRoute } from "next";

// Lets students add KNOT to their home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KNOT",
    short_name: "KNOT",
    description: "Every event at IIT Gandhinagar, and the people going to it.",
    start_url: "/discover",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f3f7",
    theme_color: "#f2f3f7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
