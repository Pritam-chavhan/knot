import { KnotLoader } from "@/components/knot-loader";

// Shown while a signed-in page loads (only if it takes a moment).
export default function Loading() {
  return <KnotLoader />;
}
