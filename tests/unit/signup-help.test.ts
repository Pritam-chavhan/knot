import { describe, expect, it } from "vitest";
import { helpEmail } from "@/features/signup-help/emails";

const site = "https://knot-tau.vercel.app";

describe("help emails", () => {
  it("point someone without a code to Spam and a fresh code", () => {
    const e = helpEmail({ stage: "code_sent", attempt: 1, email: "riya.s@iitgn.ac.in", name: null, site });
    expect(e.subject).toBe("Your KNOT sign-in code is waiting");
    expect(e.text).toContain("Spam");
    expect(e.text).toContain(`${site}/?email=riya.s%40iitgn.ac.in`);
    expect(e.text.startsWith("Hi,")).toBe(true);
  });

  it("send a verified student to finish their profile, by first name", () => {
    const e = helpEmail({ stage: "verified", attempt: 2, email: "a@iitgn.ac.in", name: "Harshit Khurana", site });
    expect(e.text.startsWith("Hi Harshit,")).toBe(true);
    expect(e.html).toContain(`${site}/onboarding`);
  });

  it("escape names in the HTML", () => {
    const e = helpEmail({ stage: "verified", attempt: 1, email: "a@iitgn.ac.in", name: "<b>x</b>", site });
    expect(e.html).not.toContain("<b>x</b>");
    expect(e.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
