import { requireAdmin } from "@/lib/auth";
import { SignupsView, type Filter, type Signup } from "@/features/admin/signups";

export const metadata = { title: "Sign-ups" };

const FILTERS: Filter[] = ["all", "stuck", "code_sent", "verified", "joined"];

export default async function AdminSignups({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const { supabase } = await requireAdmin();
  const { stage } = await searchParams;
  const filter = FILTERS.includes(stage as Filter) ? (stage as Filter) : "all";
  const [{ data, error }, helper] = await Promise.all([supabase.rpc("admin_signups", { p_limit: 500 }), supabase.rpc("admin_helper_status")]);
  if (error) throw new Error("signups_failed");
  return <SignupsView rows={(data ?? []) as Signup[]} filter={filter} helperSeen={(helper.data as string | null) ?? null} />;
}
