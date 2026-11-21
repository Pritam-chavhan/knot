/**
 * KNOT campus email feed
 *
 * Runs inside your own Gmail, once a minute. It sends new mail that came
 * through IITGN mailing lists to KNOT, which turns event announcements into
 * events. Mail sent only to you personally doesn't match and is never sent.
 *
 * Setup (once):
 *   1. Open https://script.google.com while signed in to your IITGN account.
 *   2. New project, paste this whole file.
 *   3. Run "createToken" and allow access when Google asks. It keeps a new
 *      private token in this project's settings and logs its fingerprint;
 *      register that fingerprint with KNOT. The token itself never leaves
 *      your account except to talk to KNOT.
 *   4. Run "checkQuery" to see which mails would be sent (only you see the log).
 *   5. Run "setup".
 *
 * To stop: run "stop", or delete the project.
 *
 * Sign-up helper (optional, same project):
 *   Run "setupHelper" once. Every 10 minutes it asks KNOT who is stuck
 *   signing up and emails them help from this account, as "Pritam from
 *   KNOT". KNOT decides who and when: at most two emails per student, never
 *   after they've joined. To check without sending, run "previewHelper".
 *   To stop it, run "stopHelper".
 */

const KNOT_URL = "https://knot-tau.vercel.app/api/ingest/email";
const HELPER_URL = "https://knot-tau.vercel.app/api/signup-help";
const HELPER_NAME = "Pritam from KNOT";

// Mail that came through an IITGN mailing list (Google Groups) and was sent
// from an iitgn.ac.in address, not by you. Newsletters, account notices and
// other personal mail don't match.
const QUERY = "list:iitgn.ac.in from:iitgn.ac.in -from:me -in:chats -in:spam -in:trash";

const BATCH = 5; // mails per request
const MAX_PER_RUN = 10; // the rest follow on the next run (fits free AI rate limits)
const FIRST_LOOK_BACK_DAYS = 3; // so events already announced show up

// Creates a new private token (replacing any old one) and logs only its
// SHA-256 fingerprint, which is what KNOT stores.
function createToken() {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("token", token);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  const hex = digest.map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
  console.log("New token saved in this project. Fingerprint for KNOT: " + hex);
}

function token_() {
  const token = PropertiesService.getScriptProperties().getProperty("token");
  if (!token) throw new Error('Run "createToken" first.');
  return token;
}

function setup() {
  token_();
  stop();
  ScriptApp.newTrigger("sendNewMail").timeBased().everyMinutes(1).create();
  const props = PropertiesService.getScriptProperties();
  props.setProperty("since", String(Math.floor(Date.now() / 1000) - FIRST_LOOK_BACK_DAYS * 24 * 3600));
  props.deleteProperty("sent");
  sendNewMail();
  console.log("KNOT feed is on. It checks for new campus mail every minute.");
}

function stop() {
  deleteTriggers_("sendNewMail");
  console.log("KNOT feed is off.");
}

function deleteTriggers_(handler) {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === handler)
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

// ---- Sign-up helper ----

function setupHelper() {
  token_();
  deleteTriggers_("helpStuckSignups");
  ScriptApp.newTrigger("helpStuckSignups").timeBased().everyMinutes(10).create();
  helpStuckSignups();
  console.log("Sign-up helper is on. It checks for stuck sign-ups every 10 minutes.");
}

function stopHelper() {
  deleteTriggers_("helpStuckSignups");
  console.log("Sign-up helper is off.");
}

function callHelper_(payload) {
  const res = UrlFetchApp.fetch(HELPER_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("KNOT answered " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}

// Asks KNOT who needs help, emails them, and reports back what was sent.
function helpStuckSignups() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const { emails } = callHelper_({ action: "claim" });
    const sent = [];
    const failed = [];
    for (const e of emails || []) {
      try {
        GmailApp.sendEmail(e.to, e.subject, e.text, { htmlBody: e.html, name: HELPER_NAME });
        sent.push(e.id);
      } catch (err) {
        console.warn("Couldn't email " + e.to + ": " + err);
        failed.push(e.id);
      }
    }
    if (sent.length || failed.length) callHelper_({ action: "done", sent: sent, failed: failed });
    if (sent.length) console.log("Sent " + sent.length + " help email(s).");
  } finally {
    lock.releaseLock();
  }
}

// Shows who would be emailed right now, without sending. Note: this marks
// them as claimed for 30 minutes, after which they're due again.
function previewHelper() {
  const { emails } = callHelper_({ action: "claim" });
  if (!emails || !emails.length) return console.log("Nobody needs a help email right now.");
  emails.forEach((e) => console.log(e.to + " | " + e.subject));
}

// Lists the subjects that would be sent from the last 7 days. Nothing is sent.
function checkQuery() {
  const threads = GmailApp.search(QUERY + " newer_than:7d", 0, 50);
  console.log(threads.length + " conversations match in the last 7 days:");
  threads.forEach((t) => console.log("- " + t.getFirstMessageSubject()));
}

// True only if Gmail's own check on arrival (DMARC) confirms the sender's
// iitgn.ac.in address. The first Authentication-Results header is the one
// Gmail added; anything below it came with the mail and isn't trusted.
function verifiedSender(message) {
  const raw = message.getRawContent();
  const end = raw.search(/\r?\n\r?\n/);
  const head = (end > 0 ? raw.slice(0, end) : raw).replace(/\r?\n[ \t]+/g, " ");
  const line = head.split(/\r?\n/).find((l) => /^Authentication-Results:/i.test(l));
  if (!line || !/^Authentication-Results:\s*mx\.google\.com/i.test(line)) return false;
  const match = line.match(/dmarc=pass[^;]*header\.from=([a-z0-9.-]+)/i);
  if (!match) return false;
  const domain = match[1].toLowerCase();
  return domain === "iitgn.ac.in" || domain.endsWith(".iitgn.ac.in");
}

function sendNewMail() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const since = Number(props.getProperty("since") || Math.floor(Date.now() / 1000) - 3600);
    // Look back 10 extra minutes so late-arriving mail isn't missed, and
    // remember what was already handled so nothing goes twice.
    const from = since - 600;
    const sentIds = JSON.parse(props.getProperty("sent") || "[]");
    const already = new Set(sentIds);
    const messages = [];
    GmailApp.search(QUERY + " after:" + from, 0, 50).forEach((thread) =>
      thread.getMessages().forEach((m) => {
        if (m.getDate().getTime() / 1000 >= from && !m.isInTrash() && !already.has(m.getId())) messages.push(m);
      }),
    );
    messages.sort((a, b) => a.getDate() - b.getDate());

    let newest = since;
    let stop = false;
    for (let i = 0; i < messages.length && i < MAX_PER_RUN && !stop; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      const payload = {
        messages: batch.map((m) => ({
          id: m.getHeader("Message-ID") || m.getId(),
          from: m.getFrom(),
          subject: m.getSubject(),
          date: m.getDate().toISOString(),
          body: (m.getPlainBody() || "").slice(0, 20000),
          verified: verifiedSender(m),
        })),
      };
      const res = UrlFetchApp.fetch(KNOT_URL, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token_() },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      let results = [];
      try {
        results = JSON.parse(res.getContentText()).results || [];
      } catch (e) {
        results = [];
      }
      // Count a mail as done only when KNOT finished with it; stop at the
      // first one it couldn't, and try again from there next minute.
      for (let j = 0; j < batch.length; j++) {
        const r = results[j];
        if (!r || r.outcome === "in_progress" || r.outcome === "deferred") {
          stop = true;
          break;
        }
        sentIds.push(batch[j].getId());
        newest = Math.max(newest, Math.floor(batch[j].getDate().getTime() / 1000));
      }
      if (res.getResponseCode() !== 200) {
        console.warn("KNOT answered " + res.getResponseCode() + ". Will retry.");
        stop = true;
      }
    }
    props.setProperty("since", String(newest));
    props.setProperty("sent", JSON.stringify(sentIds.slice(-300)));
  } finally {
    lock.releaseLock();
  }
}
