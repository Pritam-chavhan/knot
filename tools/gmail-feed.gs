/**
 * KNOT campus email feed
 *
 * Runs inside your own Gmail, once a minute. It sends new mail that came
 * through IITGN mailing lists to KNOT, which turns event announcements into
 * events. Mail sent only to you personally doesn't match and is never sent.
 *
 * Setup (once):
 *   1. Open https://script.google.com while signed in to your IITGN account.
 *   2. New project, paste this whole file, and put your token below.
 *   3. Run "checkQuery" to see which mails would be sent (only you see the log).
 *   4. Run "setup" and allow access when Google asks.
 *
 * To stop: run "stop", or delete the project.
 */

const KNOT_URL = "https://knot-tau.vercel.app/api/ingest/email";
const KNOT_TOKEN = "PASTE_YOUR_TOKEN_HERE";

// Mail from IITGN mailing lists (Google Groups), not written by you.
const QUERY = "list:iitgn.ac.in -from:me -in:chats -in:spam -in:trash";

const BATCH = 5; // mails per request
const MAX_PER_RUN = 25; // the rest follow on the next run
const FIRST_LOOK_BACK_DAYS = 3; // so events already announced show up

function setup() {
  stop();
  ScriptApp.newTrigger("sendNewMail").timeBased().everyMinutes(1).create();
  const props = PropertiesService.getScriptProperties();
  props.setProperty("since", String(Math.floor(Date.now() / 1000) - FIRST_LOOK_BACK_DAYS * 24 * 3600));
  props.deleteProperty("sent");
  sendNewMail();
  console.log("KNOT feed is on. It checks for new campus mail every minute.");
}

function stop() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  console.log("KNOT feed is off.");
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
        headers: { Authorization: "Bearer " + KNOT_TOKEN },
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
