// Social links are stored as usernames and always turned back into links on
// the official site, so a profile can never point anywhere else.

export type LinkKind = "github" | "instagram" | "linkedin";

type Spec = {
  label: string;
  base: string;
  prefix: string;
  hosts: string[];
  pattern: RegExp;
  pathPrefix?: string;
  invalid: string;
};

export const LINKS: Record<LinkKind, Spec> = {
  github: {
    label: "GitHub",
    base: "https://github.com/",
    prefix: "github.com/",
    hosts: ["github.com", "www.github.com"],
    pattern: /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/,
    invalid: "That isn't a GitHub username. Paste your profile link or type the username.",
  },
  instagram: {
    label: "Instagram",
    base: "https://instagram.com/",
    prefix: "instagram.com/",
    hosts: ["instagram.com", "www.instagram.com", "instagr.am"],
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    invalid: "That isn't an Instagram username. Use letters, numbers, dots and underscores.",
  },
  linkedin: {
    label: "LinkedIn",
    base: "https://www.linkedin.com/in/",
    prefix: "linkedin.com/in/",
    hosts: ["linkedin.com", "www.linkedin.com", "in.linkedin.com"],
    pathPrefix: "in",
    pattern: /^[A-Za-z0-9][A-Za-z0-9-]{2,99}$/,
    invalid: "Paste the link to your own LinkedIn profile (it has /in/ in it).",
  },
};

export const LINK_KINDS = Object.keys(LINKS) as LinkKind[];

// "https://github.com/asha-k/", "github.com/asha-k", "@asha-k" and "asha-k"
// all become "asha-k". Empty input clears the link.
export function parseHandle(kind: LinkKind, input: string): { value: string | null; error?: string } {
  const spec = LINKS[kind];
  let raw = input.trim();
  if (!raw) return { value: null };

  const looksLikeUrl = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}\//i.test(raw) || /^https?:\/\//i.test(raw);
  if (looksLikeUrl) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return { value: null, error: spec.invalid };
    }
    if (!spec.hosts.includes(url.hostname.toLowerCase())) return { value: null, error: spec.invalid };
    const parts = url.pathname.split("/").filter(Boolean);
    if (spec.pathPrefix) {
      if (parts[0]?.toLowerCase() !== spec.pathPrefix) return { value: null, error: spec.invalid };
      parts.shift();
    }
    raw = parts[0] ?? "";
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return { value: null, error: spec.invalid };
    }
  }

  raw = raw.replace(/^@/, "");
  if (!spec.pattern.test(raw)) return { value: null, error: spec.invalid };
  return { value: raw };
}

export function linkUrl(kind: LinkKind, handle: string) {
  return LINKS[kind].base + encodeURIComponent(handle);
}
