"use server";

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type PhotoResult = { error?: string; ok?: boolean };

// The picker sends a 768 px JPEG, so anything far bigger isn't from our app.
const MAX_BYTES = 1024 * 1024;
const MAX_PIXELS = 4_000_000;

sharp.cache(false);
sharp.concurrency(1);

// Only JPEG, PNG and WebP, checked by their first bytes before any decoder runs.
function kind(b: Buffer): "jpeg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

// One image at a time per server instance, so a burst of uploads can't
// exhaust memory.
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export async function uploadPhoto(formData: FormData): Promise<PhotoResult> {
  const { supabase, user } = await requireMember({ allowNotOnboarded: true });
  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > MAX_BYTES) return { error: "That photo is too large. Try a smaller one." };

  const { error: limited } = await supabase.rpc("check_rate_limit", { p_action: "avatar_upload", p_max: 20, p_window: "1 day" });
  if (limited) return { error: "You've changed your photo a lot today. Try again tomorrow." };

  const input = Buffer.from(await file.arrayBuffer());
  const format = kind(input);
  if (!format) return { error: "We couldn't read that image. Try a JPG or PNG." };

  // Decode and re-encode on the server: whatever the browser sent, we store a
  // clean 512 px WebP with no metadata (phone photos often carry location).
  let photo: Buffer;
  try {
    photo = await oneAtATime(async () => {
      const image = sharp(input, { limitInputPixels: MAX_PIXELS, animated: false, failOn: "error" });
      const meta = await image.metadata();
      if (meta.format !== format) throw new Error("format");
      return image.rotate().resize(512, 512, { fit: "cover", position: "centre" }).webp({ quality: 82 }).toBuffer();
    });
  } catch {
    return { error: "We couldn't read that image. Try a JPG or PNG." };
  }

  const admin = createAdminClient();
  const path = `${user.id}/${randomBytes(15).toString("base64url")}.webp`;
  const { error: uploadError } = await admin.storage.from("avatars").upload(path, photo, { contentType: "image/webp", upsert: false });
  if (uploadError) return { error: "Your photo didn't upload. Check your connection and try again." };

  const { data: previous, error } = await admin.rpc("set_avatar", { p_user: user.id, p_path: path });
  if (error) {
    await admin.storage.from("avatars").remove([path]);
    return { error: "Your photo didn't save. Try again in a moment." };
  }
  if (typeof previous === "string" && previous) await admin.storage.from("avatars").remove([previous]);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removePhoto(): Promise<PhotoResult> {
  const { user } = await requireMember({ allowNotOnboarded: true });
  const admin = createAdminClient();
  const { data: previous, error } = await admin.rpc("set_avatar", { p_user: user.id, p_path: null });
  if (error) return { error: "Your photo wasn't removed. Try again in a moment." };
  if (typeof previous === "string" && previous) await admin.storage.from("avatars").remove([previous]);
  revalidatePath("/", "layout");
  return { ok: true };
}
