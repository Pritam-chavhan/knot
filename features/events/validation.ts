import { z } from "zod";
import { parseIstLocal } from "@/lib/time";
import { CATEGORY_IDS } from "./categories";

const MAX_AHEAD_DAYS = 90;

const startsAt = z
  .string()
  .transform((v, ctx) => {
    const d = parseIstLocal(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Pick a date and time." });
      return z.NEVER;
    }
    return d;
  })
  .refine((d) => d.getTime() > Date.now() - 5 * 60_000, "Pick a time that hasn't passed yet.")
  .refine((d) => d.getTime() < Date.now() + MAX_AHEAD_DAYS * 86_400_000, `Pick a date in the next ${MAX_AHEAD_DAYS} days.`);

const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .optional()
    .transform((v) => (v ? v : null));

const durationMinutes = z.coerce.number().int().min(15).max(24 * 60).optional();

export const hostEventSchema = z.object({
  title: z.string().trim().min(3, "Give your plan a name.").max(120, "Keep the name under 120 characters."),
  category: z.enum(CATEGORY_IDS, { message: "Pick what kind of plan it is." }),
  startsAt,
  durationMinutes,
  venue: z.string().trim().min(2, "Say where to meet.").max(120, "Keep the place under 120 characters."),
  description: optionalText(1000, "Keep the details under 1,000 characters."),
  capacity: z
    .union([z.literal(""), z.coerce.number().int().min(2, "At least 2 people, including you.").max(500, "500 people at most.")])
    .transform((v) => (v === "" ? null : v)),
  joinMode: z.enum(["open", "request"]),
});

export const adminEventSchema = z.object({
  source: z.enum(["official", "community"]),
  title: z.string().trim().min(3, "Add the event name.").max(120, "Keep the name under 120 characters."),
  category: z.enum(CATEGORY_IDS, { message: "Pick a category." }),
  startsAt,
  durationMinutes,
  venue: z.string().trim().min(2, "Add the venue.").max(120),
  organiser: optionalText(120, "Keep the organiser under 120 characters."),
  description: optionalText(4000, "Keep the description under 4,000 characters."),
  registrationUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https:\/\/[^\s]+$/.test(v), "Use a full link starting with https://"),
});

export type HostEventInput = z.output<typeof hostEventSchema>;
export type AdminEventInput = z.output<typeof adminEventSchema>;

export const endsAtFrom = (start: Date, minutes?: number) => (minutes ? new Date(start.getTime() + minutes * 60_000) : null);
