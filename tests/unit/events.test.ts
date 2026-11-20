import { describe, expect, it } from "vitest";
import { dayLabel, formatClock, istDayKey, parseIstLocal, toIstLocalInput, whenLabel } from "@/lib/time";
import { adminEventSchema, hostEventSchema } from "@/features/events/validation";

const inHours = (h: number) => toIstLocalInput(new Date(Date.now() + h * 3_600_000));

describe("India time", () => {
  it("reads a typed time as India time, whatever the server's zone", () => {
    expect(parseIstLocal("2026-11-21T18:30")!.toISOString()).toBe("2026-11-21T13:00:00.000Z");
    expect(parseIstLocal("21/11/2026")).toBeNull();
  });

  it("puts late-night UTC moments on the right India day", () => {
    expect(istDayKey(new Date("2026-11-20T19:00:00Z"))).toBe("2026-11-21");
  });

  it("formats clock times and day labels", () => {
    const now = new Date("2026-11-20T06:00:00Z"); // 11:30 am IST
    expect(formatClock(new Date("2026-11-20T12:30:00Z"))).toBe("6:00 pm");
    expect(dayLabel(new Date("2026-11-20T15:00:00Z"), now)).toBe("Today");
    expect(dayLabel(new Date("2026-11-21T05:00:00Z"), now)).toBe("Tomorrow");
    expect(whenLabel(new Date("2026-11-20T17:30:00Z"), now)).toBe("Today, 11:00 pm");
  });

  it("round-trips the input format", () => {
    expect(toIstLocalInput(parseIstLocal("2026-12-01T07:05")!)).toBe("2026-12-01T07:05");
  });
});

describe("hosting a plan", () => {
  const base = { title: "Badminton doubles", category: "sports", startsAt: inHours(3), venue: "Sports complex", capacity: "4", joinMode: "open" };

  it("accepts a normal plan", () => {
    const r = hostEventSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data!.capacity).toBe(4);
  });

  it("treats an empty spots field as no limit", () => {
    expect(hostEventSchema.parse({ ...base, capacity: "" }).capacity).toBeNull();
  });

  it("refuses past times, far-future times, tiny groups and unknown kinds", () => {
    expect(hostEventSchema.safeParse({ ...base, startsAt: inHours(-2) }).success).toBe(false);
    expect(hostEventSchema.safeParse({ ...base, startsAt: inHours(24 * 120) }).success).toBe(false);
    expect(hostEventSchema.safeParse({ ...base, capacity: "1" }).success).toBe(false);
    expect(hostEventSchema.safeParse({ ...base, category: "party" }).success).toBe(false);
  });
});

describe("adding an official event", () => {
  const base = { source: "official", title: "Amalthea speaker session", category: "talk", startsAt: inHours(30), venue: "Academic Block 1" };

  it("accepts https registration links only", () => {
    expect(adminEventSchema.safeParse({ ...base, registrationUrl: "https://forms.gle/abc" }).success).toBe(true);
    expect(adminEventSchema.safeParse({ ...base, registrationUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(adminEventSchema.safeParse({ ...base, registrationUrl: "http://example.com" }).success).toBe(false);
  });
});
