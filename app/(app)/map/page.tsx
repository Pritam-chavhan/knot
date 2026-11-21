import { requireMember } from "@/lib/auth";
import { MapScreen } from "@/features/map/map-screen";
import type { Bounds, Sharing } from "@/features/map/types";

export const metadata = { title: "Campus map" };

export default async function MapPage() {
  const { supabase, user } = await requireMember();
  const [{ data: bounds }, { data: sharing }] = await Promise.all([supabase.rpc("map_settings"), supabase.rpc("my_sharing")]);
  const b = bounds as Partial<Bounds> | null;
  const valid =
    b &&
    [b.south, b.north, b.west, b.east, b.center_lat, b.center_lng].every((n) => typeof n === "number") &&
    (b.radius_m === undefined || (typeof b.radius_m === "number" && b.radius_m > 0 && b.radius_m <= 5000)) &&
    (b.polygon === undefined || (Array.isArray(b.polygon) && b.polygon.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number"))));
  return <MapScreen bounds={valid ? (b as Bounds) : null} initialSharing={(sharing as Sharing | null) ?? null} me={{ id: user.id }} />;
}
