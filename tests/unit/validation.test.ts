import { describe, expect, it } from "vitest";
import { codeSchema, onboardingSchema, toInstitutionEmail } from "@/features/auth/validation";

const D = "iitgn.ac.in";

describe("toInstitutionEmail", () => {
  it("builds the address from the part before @", () => {
    expect(toInstitutionEmail("  Asha.K ", D)).toEqual({ email: "asha.k@iitgn.ac.in" });
  });
  it("accepts a full address on the right domain", () => {
    expect(toInstitutionEmail("asha.k@iitgn.ac.in", D)).toEqual({ email: "asha.k@iitgn.ac.in" });
  });
  it("refuses other domains", () => {
    expect(toInstitutionEmail("asha@gmail.com", D).error).toMatch(/iitgn\.ac\.in/);
    expect(toInstitutionEmail("asha@eviliitgn.ac.in", D).error).toBeTruthy();
    expect(toInstitutionEmail("asha@a@iitgn.ac.in", D).error).toBeTruthy();
  });
  it("accepts a full address on any subdomain", () => {
    expect(toInstitutionEmail("Asha@CAA.iitgn.ac.in", D)).toEqual({ email: "asha@caa.iitgn.ac.in" });
    expect(toInstitutionEmail("asha@alumni.iitgn.ac.in", D)).toEqual({ email: "asha@alumni.iitgn.ac.in" });
    expect(toInstitutionEmail("asha@a-b.c2.iitgn.ac.in", D)).toEqual({ email: "asha@a-b.c2.iitgn.ac.in" });
  });
  it.each(["eviliitgn.ac.in", "iitgn.ac.in.example.com", "iitgnxac.in", ".iitgn.ac.in", "a..iitgn.ac.in", "-caa.iitgn.ac.in", "caa-.iitgn.ac.in", "caa_x.iitgn.ac.in", "a.b.c.d.iitgn.ac.in"])(
    "refuses %s",
    (host) => {
      expect(toInstitutionEmail(`asha@${host}`, D).error).toBeTruthy();
    },
  );
  it("refuses empty and malformed input", () => {
    expect(toInstitutionEmail("", D).error).toBeTruthy();
    expect(toInstitutionEmail("asha k", D).error).toBeTruthy();
    expect(toInstitutionEmail("<script>", D).error).toBeTruthy();
  });
});

describe("codeSchema", () => {
  it("accepts exactly six digits", () => {
    expect(codeSchema.safeParse("123456").success).toBe(true);
    expect(codeSchema.safeParse("12345").success).toBe(false);
    expect(codeSchema.safeParse("12345a").success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const base = { displayName: "Asha", programme: "BTech CSE", batchYear: "2027", bio: "", interests: ["1", "2"], showGoing: true };
  it("accepts a valid profile", () => {
    expect(onboardingSchema.safeParse(base).success).toBe(true);
  });
  it("caps interests at eight", () => {
    const r = onboardingSchema.safeParse({ ...base, interests: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] });
    expect(r.success).toBe(false);
  });
  it("requires a name", () => {
    expect(onboardingSchema.safeParse({ ...base, displayName: "  " }).success).toBe(false);
  });
});
