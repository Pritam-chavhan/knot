import { describe, expect, it } from "vitest";
import { chatDay, chatTime } from "@/lib/time";
import { chatError } from "@/features/chat/errors";

// 21 Nov 2026, 3:00 pm in India.
const now = new Date("2026-11-21T09:30:00Z");

describe("chat times", () => {
  it("shows the clock today, then Yesterday, a weekday, then a date", () => {
    expect(chatTime(new Date("2026-11-21T04:30:00Z"), now)).toBe("10:00 am");
    expect(chatTime(new Date("2026-11-20T15:00:00Z"), now)).toBe("Yesterday");
    expect(chatTime(new Date("2026-11-18T09:30:00Z"), now)).toBe("Wed");
    expect(chatTime(new Date("2026-11-02T09:30:00Z"), now)).toBe("2 Nov");
  });

  it("uses India time for day breaks, not the server's", () => {
    // 11:30 pm on the 20th in UTC is already the 21st in India.
    expect(chatDay(new Date("2026-11-20T23:30:00Z"), now)).toBe("Today");
    expect(chatDay(new Date("2026-11-20T10:00:00Z"), now)).toBe("Yesterday");
    expect(chatDay(new Date("2026-11-16T10:00:00Z"), now)).toBe("Mon, 16 Nov");
  });
});

describe("chat errors", () => {
  it("turns database codes into directions and never shows raw errors", () => {
    expect(chatError({ message: "not_accepting" })).toMatch(/aren't taking connection requests/);
    expect(chatError({ message: "rate_limited:message" })).toMatch(/Wait a few minutes/);
    expect(chatError({ message: 'duplicate key value violates unique constraint "x"' })).toBe(
      "That didn't work. Check your connection and try again.",
    );
  });
});
