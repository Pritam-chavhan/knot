import { requireAdmin } from "@/lib/auth";
import { SignupsView, type Filter, type Signup } from "@/features/admin/signups";

export const metadata = { title: "Sign-ups" };

const FILTERS: Filter[] = ["all", "stuck", "code_sent", "verified", "joined"];

export default async function AdminSignups({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const { supabase } = await requireAdmin();
  const { stage } = await searchParams;
  const filter = FILTERS.includes(stage as Filter) ? (stage as Filter) : "all";
  const { data, error } = await supabase.rpc("admin_signups", { p_limit: 500 });
  if (error) throw new Error("signups_failed");
  return <SignupsView rows={(data ?? []) as Signup[]} filter={filter} />;
}
