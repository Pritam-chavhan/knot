import { describe, expect, it } from "vitest";
import { ago, mapError, metres, minutesLeft } from "@/features/map/types";

describe("map helpers", () => {
  it("measures short distances on campus", () => {
    // About 111 metres per 0.001° of latitude.
    expect(Math.round(metres({ lat: 23.212, lng: 72.6855 }, { lat: 23.213, lng: 72.6855 }))).toBe(111);
    expect(metres({ lat: 23.212, lng: 72.6855 }, { lat: 23.212, lng: 72.6855 })).toBe(0);
  });

  it("counts down whole minutes and never below zero", () => {
    const now = Date.parse("2026-11-21T10:00:00Z");
    expect(minutesLeft("2026-11-21T10:14:10Z", now)).toBe(15);
    expect(minutesLeft("2026-11-21T09:59:00Z", now)).toBe(0);
  });

  it("says how fresh a spot is", () => {
    const now = Date.parse("2026-11-21T10:00:00Z");
    expect(ago("2026-11-21T09:59:40Z", now)).toBe("just now");
    expect(ago("2026-11-21T09:55:00Z", now)).toBe("5 min ago");
  });

  it("explains refusals in plain words", () => {
    expect(mapError({ message: "off_campus" })).toMatch(/not on campus/);
    expect(mapError({ message: "rate_limited:wave" })).toMatch(/Try again later/);
    expect(mapError({ message: "relation does not exist" })).toBe("That didn't work. Check your connection and try again.");
  });
});
