import { z } from "zod";

// The part before @, as students type it. Letters, digits, dots, dashes,
// underscores and plus signs only; 1 to 64 characters.
export const localPartSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your college email.")
  .max(64, "That email is too long.")
  .regex(/^[a-z0-9._+-]+$/, "Use only the part before @, without spaces.");

// Accepts either "name" or "name@domain"; returns the full address on the
// institution domain, or an error message.
export function toInstitutionEmail(input: string, domain: string): { email?: string; error?: string } {
  const raw = input.trim().toLowerCase();
  let local = raw;
  if (raw.includes("@")) {
    const [l, d] = raw.split("@");
    if (d !== domain) return { error: `Use your @${domain} email.` };
    local = l;
  }
  const parsed = localPartSchema.safeParse(local);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { email: `${parsed.data}@${domain}` };
}

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your email.");

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1, "Add your name.").max(40, "Keep your name under 40 characters."),
  programme: z.string().trim().min(2, "Add your programme.").max(60),
  batchYear: z.coerce.number().int().min(2000).max(2100),
  bio: z.string().trim().max(280, "Keep your bio under 280 characters.").optional().default(""),
  interests: z.array(z.coerce.number().int().positive()).max(8, "Pick up to 8 interests."),
  showGoing: z.boolean(),
});
