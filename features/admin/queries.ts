import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DayPoint = { day: string; signups: number; active: number };
export type Stats = {
  students: number;
  onboarded: number;
  suspended: number;
  signups_today: number;
  signups_7d: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  events_upcoming: number;
  events_added: number;
  plans_hosted: number;
  going_taps: number;
  interested_taps: number;
  join_requests: number;
  join_accepted: number;
  open_reports: number;
  daily: DayPoint[];
};

export async function loadStats(supabase: SupabaseClient): Promise<Stats> {
  const { data, error } = await supabase.rpc("admin_stats");
  if (error || !data) throw new Error("stats_failed");
  return data as Stats;
}

export type PersonRow = {
  id: string;
  email: string;
  display_name: string | null;
  programme: string | null;
  batch_year: number | null;
  role: "student" | "admin";
  status: "active" | "suspended";
  created_at: string;
  last_seen_at: string | null;
  onboarded: boolean;
  is_founder: boolean;
};

export async function loadPeople(supabase: SupabaseClient, q: string | null, page: number) {
  const { data, error } = await supabase.rpc("admin_people", { p_query: q, p_limit: 51, p_offset: page * 50 });
  if (error) throw new Error("people_failed");
  const rows = (data ?? []) as PersonRow[];
  return { rows: rows.slice(0, 50), hasMore: rows.length > 50 };
}

export type AdminEventRow = {
  id: string;
  title: string;
  source_type: "official" | "community" | "student_hosted";
  status: string;
  review_status: string;
  starts_at: string;
  venue: string | null;
  host_name: string | null;
  going: number;
  interested: number;
};

export async function loadAdminEvents(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("admin_events", { p_limit: 150 });
  if (error) throw new Error("events_failed");
  return ((data ?? []) as AdminEventRow[]).map((e) => ({ ...e, going: Number(e.going), interested: Number(e.interested) }));
}

export type LogRow = {
  id: string;
  created_at: string;
  action: string;
  admin_name: string | null;
  target_type: string;
  target_id: string;
  target_label: string;
  note: string | null;
};

export async function loadLog(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("admin_log", { p_limit: 100 });
  if (error) throw new Error("log_failed");
  return (data ?? []) as LogRow[];
}
