// Turns database refusals about people and chats into directions.
const MESSAGES: Record<string, string> = {
  not_found: "This person isn't available on KNOT right now.",
  not_accepting: "They aren't taking connection requests right now.",
  note_too_long: "Keep your note under 140 characters.",
  not_allowed: "That request isn't available any more. Reload to see the latest.",
  empty_message: "Type a message first.",
  message_too_long: "Keep messages under 2,000 characters.",
  not_available: "They can't receive messages right now.",
  bad_reason: "Pick what's wrong.",
  details_too_long: "Keep the details under 1,000 characters.",
};

export function chatError(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? "";
  if (msg.startsWith("rate_limited")) return "You're doing that a lot. Wait a few minutes, then try again.";
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
  return key ? MESSAGES[key] : "That didn't work. Check your connection and try again.";
}

export const REPORT_REASONS = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "unsafe", label: "Makes me feel unsafe" },
  { id: "inappropriate", label: "Sexual or inappropriate" },
  { id: "fake", label: "Fake profile or pretending to be someone" },
  { id: "spam", label: "Spam or scam" },
  { id: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
