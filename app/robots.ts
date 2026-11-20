import type { MetadataRoute } from "next";

// Only the landing page is meant for search engines; everything else is for
// signed-in students.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/$", disallow: ["/"] },
  };
}
