// Turns database refusals into directions a student can act on.
const MESSAGES: Record<string, string> = {
  not_found: "This event isn't available any more.",
  event_full: "This plan just filled up.",
  request_required: "The host lets people in on this one. Ask to join instead.",
  event_closed: "This event was cancelled.",
  event_over: "This event has already happened.",
  host_must_go: "You're hosting this, so you're going. Cancel the plan if it's off.",
  not_request_event: "Anyone can join this one. Tap Going instead.",
  note_too_long: "Keep your note under 280 characters.",
  not_allowed: "You can't do that on this event.",
  bad_time: "Pick a time in the next 90 days that hasn't passed.",
  bad_capacity: "Spots must be between 2 and 500.",
  bad_venue: "Say where to meet.",
  bad_join_mode: "Choose who can join.",
};

export function friendlyError(error: { message?: string } | null | undefined, fallback = "That didn't work. Try again in a moment."): string {
  const msg = error?.message ?? "";
  if (msg.startsWith("rate_limited")) return "You're doing that a lot. Wait a few minutes, then try again.";
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
  return key ? MESSAGES[key] : fallback;
}
