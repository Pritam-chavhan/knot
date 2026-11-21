// The help emails the sign-up helper sends. Short, plain and personal: they
// come from Pritam's own IITGN address, and a reply reaches him.

export type HelpStage = "code_sent" | "verified";
export type HelpEmail = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// `signIn` is a fresh sign-in code and one-tap link made for this student,
// when KNOT could make one. It replaces any code sent before.
export function helpEmail(opts: {
  stage: HelpStage;
  attempt: 1 | 2;
  email: string;
  name: string | null;
  site: string;
  signIn?: { code: string; link: string } | null;
}): HelpEmail {
  const { stage, attempt, email, site, signIn: fresh } = opts;
  const hi = opts.name?.trim() ? `Hi ${opts.name.trim().split(" ")[0]},` : "Hi,";
  const signIn = `${site}/?email=${encodeURIComponent(email)}`;

  let subject: string;
  let lines: string[];
  let button: { label: string; href: string };

  let code: string | null = null;
  if (stage === "code_sent" && fresh) {
    code = fresh.code;
    subject = attempt === 1 ? `Your KNOT sign-in code: ${fresh.code}` : `A new KNOT sign-in code: ${fresh.code}`;
    button = { label: "Sign in to KNOT", href: fresh.link };
    lines = [
      attempt === 1
        ? "You started joining KNOT, the campus app for IITGN. Your sign-in email may not have reached you, so here's a fresh code from my IITGN account."
        : "Here's another fresh code, in case the last one didn't work out.",
      "Type this code on the KNOT sign-in screen, or tap the button below on your phone:",
      "This code replaces any code sent before. If you've already got in, just ignore this.",
      "Still stuck? Reply to this email and I'll get you in myself.",
    ];
  } else if (stage === "code_sent") {
    subject = attempt === 1 ? "Your KNOT sign-in code is waiting" : "Still want in to KNOT? I can help";
    button = { label: "Get a fresh code", href: signIn };
    lines =
      attempt === 1
        ? [
            "You started joining KNOT, the campus app for IITGN, but didn't finish signing in. Here's how to get in:",
            `1. Search your mail for "KNOT". The code often lands in Spam or Promotions. If it's in Spam, tap "Not spam".`,
            "2. Or tap the button below, then \"Email me a sign-in code\" for a fresh one. Use only the newest code.",
            "3. Still stuck? Just reply to this email and I'll sort it out.",
          ]
        : [
            "Looks like signing in to KNOT still didn't work out. Sorry about that.",
            "Tap the button below for a fresh code, then check Spam and Promotions for an email from KNOT.",
            "If it still doesn't come through, reply to this email and I'll get you in myself.",
          ];
  } else {
    subject = attempt === 1 ? "You're one step away from KNOT" : "Your KNOT profile is almost done";
    button = { label: "Finish my profile", href: `${site}/onboarding` };
    lines =
      attempt === 1
        ? [
            "You're signed in to KNOT, but your profile isn't finished yet, so nobody can see you and you can't see who's going to things.",
            "It takes about a minute: your name, programme and a few interests.",
            "If something went wrong along the way, just reply and tell me.",
          ]
        : [
            "Quick reminder: your KNOT profile still isn't finished, so you're missing who's going to what on campus.",
            "Tap the button below to finish it. If you're stuck anywhere, reply and I'll help.",
          ];
  }

  const sign = ["Pritam", "KNOT, built for IITGN"];
  const textLines = code ? [lines[0], "", lines[1], "", `    ${code}`, "", ...lines.slice(2)] : lines;
  const text = [hi, "", ...textLines, "", `${button.label}: ${button.href}`, "", ...sign].join("\n");
  const codeBlock = code
    ? `<p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;background:#f2f3f7;border-radius:14px;padding:14px 0;margin:6px 0 16px">${esc(code)}</p>`
    : "";
  const htmlLines = code ? [lines[0], lines[1]] : lines;
  const afterLines = code ? lines.slice(2) : [];
  const html = `<!doctype html><html><body style="margin:0;background:#f2f3f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#17142b">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="font-size:20px;font-weight:800;color:#5a3df0;margin:0 0 18px">KNOT</p>
<div style="background:#fff;border-radius:20px;padding:24px">
<p style="font-size:16px;margin:0 0 12px">${esc(hi)}</p>
${htmlLines.map((l) => `<p style="font-size:15px;line-height:1.5;color:#47435c;margin:0 0 10px">${esc(l)}</p>`).join("\n")}
${codeBlock}
<p style="margin:20px 0 6px"><a href="${esc(button.href)}" style="display:inline-block;background:#5a3df0;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px">${esc(button.label)}</a></p>
${afterLines.map((l) => `<p style="font-size:14px;line-height:1.5;color:#6c6880;margin:14px 0 0">${esc(l)}</p>`).join("\n")}
</div>
<p style="font-size:14px;color:#47435c;margin:18px 4px 0">${sign.map(esc).join("<br>")}</p>
</div></body></html>`;
  return { subject, text, html };
}
