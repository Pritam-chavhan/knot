import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The Apps Script runs in Google's servers; load its sender check here.
const verifiedSender = new Function(readFileSync("tools/gmail-feed.gs", "utf8") + "\nreturn verifiedSender;")() as (m: { getRawContent: () => string }) => boolean;
const mail = (...headers: string[]) => ({ getRawContent: () => headers.join("\r\n") + "\r\n\r\nBody" });

describe("Gmail script sender check", () => {
  it.each([
    ["an IITGN sender that passed DMARC", ["Authentication-Results: mx.google.com;\r\n       dkim=pass header.i=@iitgn.ac.in;\r\n       dmarc=pass (p=NONE) header.from=iitgn.ac.in"], true],
    ["a subdomain sender", ["Authentication-Results: mx.google.com; dmarc=pass header.from=students.iitgn.ac.in"], true],
    ["a failed check", ["Authentication-Results: mx.google.com; dmarc=fail header.from=iitgn.ac.in"], false],
    ["a look-alike domain", ["Authentication-Results: mx.google.com; dmarc=pass header.from=eviliitgn.ac.in"], false],
    ["another domain", ["Authentication-Results: mx.google.com; dmarc=pass header.from=gmail.com"], false],
    ["a forged result below Gmail's", ["Authentication-Results: mx.google.com; dmarc=fail header.from=iitgn.ac.in", "Authentication-Results: mx.google.com; dmarc=pass header.from=iitgn.ac.in"], false],
    ["a result not added by Gmail", ["Authentication-Results: evil.example; dmarc=pass header.from=iitgn.ac.in"], false],
    ["no result at all", ["From: x@iitgn.ac.in"], false],
  ])("%s", (_name, headers, expected) => {
    expect(verifiedSender(mail(...(headers as string[])))).toBe(expected);
  });
});
