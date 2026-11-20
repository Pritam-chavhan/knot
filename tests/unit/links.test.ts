import { describe, expect, it } from "vitest";
import { linkUrl, parseHandle } from "@/features/profile/links";

describe("parseHandle", () => {
  it.each([
    ["github", "https://github.com/asha-k/", "asha-k"],
    ["github", "github.com/asha-k?tab=repositories", "asha-k"],
    ["github", "@asha-k", "asha-k"],
    ["github", "  asha-k  ", "asha-k"],
    ["instagram", "https://www.instagram.com/asha.k_/", "asha.k_"],
    ["instagram", "@asha.k_", "asha.k_"],
    ["linkedin", "https://www.linkedin.com/in/asha-kumar-123/", "asha-kumar-123"],
    ["linkedin", "in.linkedin.com/in/asha-kumar", "asha-kumar"],
    ["linkedin", "asha-kumar", "asha-kumar"],
  ] as const)("%s: %s -> %s", (kind, input, expected) => {
    expect(parseHandle(kind, input)).toEqual({ value: expected });
  });

  it("clears the link when empty", () => {
    expect(parseHandle("github", "   ")).toEqual({ value: null });
  });

  it.each([
    ["github", "https://evil.example/asha"],
    ["github", "https://github.com.evil.example/asha"],
    ["github", "javascript:alert(1)"],
    ["github", "asha--k"],
    ["instagram", "https://instagram.com.phish.io/asha"],
    ["instagram", "asha k"],
    ["linkedin", "https://www.linkedin.com/company/iitgn"],
    ["linkedin", "https://www.linkedin.com/in/"],
  ] as const)("rejects %s: %s", (kind, input) => {
    expect(parseHandle(kind, input).error).toBeTruthy();
  });
});

describe("linkUrl", () => {
  it("always builds the official address", () => {
    expect(linkUrl("github", "asha-k")).toBe("https://github.com/asha-k");
    expect(linkUrl("instagram", "asha.k_")).toBe("https://instagram.com/asha.k_");
    expect(linkUrl("linkedin", "asha-kumar")).toBe("https://www.linkedin.com/in/asha-kumar");
  });
});
