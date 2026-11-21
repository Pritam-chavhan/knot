"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { BackButton } from "@/components/back-button";
import { browserClient } from "@/lib/supabase/browser";
import { chatDay, formatClock, istDayKey } from "@/lib/time";
import { chatError } from "./errors";
import { PersonMenu } from "./person-menu";
import { ReportForm } from "./report-form";
import { Sheet } from "./sheet";
import type { ThreadMessage } from "./queries";

type Msg = ThreadMessage & { pending?: boolean; failed?: string };

type Props = {
  connectionId: string;
  me: string;
  other: { id: string; name: string; subtitle: string; avatar: string | null };
  initial: ThreadMessage[];
};

const sortByTime = (a: Msg, b: Msg) => a.created_at.localeCompare(b.created_at);

export function ChatThread({ connectionId, me, other, initial }: Props) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = other.name.split(" ")[0];

  const markRead = useCallback(() => {
    if (readTimer.current) return;
    readTimer.current = setTimeout(() => {
      readTimer.current = null;
      if (document.visibilityState === "visible") void browserClient()?.rpc("mark_chat_read", { p_connection: connectionId });
    }, 1200);
  }, [connectionId]);

  const add = useCallback((m: Msg) => {
    setMessages((list) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? { ...m } : x)) : [...list, m].sort(sortByTime)));
  }, []);

  // New messages arrive live. Row-level security means this channel only
  // ever receives messages from this chat, for its two members.
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`chat:${connectionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `connection_id=eq.${connectionId}` },
        (payload: { new: ThreadMessage }) => {
          const m = payload.new;
          if (!m?.id) return;
          add({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at });
          if (m.sender_id !== me) markRead();
        },
      )
      .subscribe((status: string) => {
        // Only mention a lost connection if it lasts, so a brief blip doesn't flash a warning.
        if (offlineTimer.current) clearTimeout(offlineTimer.current);
        offlineTimer.current = null;
        if (status === "SUBSCRIBED") setLive(true);
        else offlineTimer.current = setTimeout(() => setLive(false), 4000);
      });

    // Catch up on anything missed while the phone was asleep.
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("connection_id", connectionId)
        .order("created_at", { ascending: false })
        .limit(50);
      for (const m of (data ?? []) as ThreadMessage[]) add(m);
      markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
      supabase.removeChannel(channel);
    };
  }, [connectionId, me, add, markRead]);

  useEffect(() => () => {
    if (readTimer.current) clearTimeout(readTimer.current);
  }, []);

  // Stay at the latest message unless the student scrolled up to read.
  useEffect(() => {
    const onScroll = () => {
      nearBottom.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    if (nearBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function deliver(id: string, body: string) {
    const supabase = browserClient();
    const { data, error } = supabase
      ? await supabase.rpc("send_message", { p_connection: connectionId, p_body: body, p_client_id: id })
      : { data: null, error: { message: "offline" } };
    if (error) {
      setMessages((list) => list.map((m) => (m.id === id ? { ...m, pending: false, failed: chatError(error) } : m)));
      return;
    }
    const sent = data as { id: string; created_at: string };
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, pending: false, failed: undefined, created_at: sent.created_at } : m)).sort(sortByTime));
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    if (body.length > 2000) return;
    const id = crypto.randomUUID();
    nearBottom.current = true;
    add({ id, sender_id: me, body, created_at: new Date().toISOString(), pending: true });
    setText("");
    requestAnimationFrame(() => boxRef.current?.focus());
    void deliver(id, body);
  }

  function retry(m: Msg) {
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, pending: true, failed: undefined } : x)));
    void deliver(m.id, m.body);
  }

  // Grow the box with the text, up to about five lines.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  const latestFromThem = [...messages].reverse().find((m) => m.sender_id !== me);
  const over = text.trim().length > 2000;
  const now = new Date();

  return (
    <main className="-mb-32 flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-line/70 bg-paper/90 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <BackButton fallback="/chats" />
        <Link href={`/people/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1 pr-2 transition-transform active:scale-[0.98]">
          <Avatar name={other.name} size={42} src={other.avatar} className="ring-0" />
          <span className="min-w-0">
            <span className="font-display block truncate text-[18px] leading-tight font-extrabold">{other.name}</span>
            <span className="block truncate text-[13px] text-muted">{other.subtitle || "View profile"}</span>
          </span>
        </Link>
        <PersonMenu
          person={{ id: other.id, name: other.name }}
          reportTarget={latestFromThem ? { type: "message", id: latestFromThem.id } : { type: "profile", id: other.id }}
          connected
          from="chat"
        />
      </header>

      {!live && (
        <p role="status" className="mx-4 mt-3 rounded-2xl bg-marigold-tint px-4 py-2 text-center text-[13px] font-semibold text-ink">
          Reconnecting… new messages will appear when you&apos;re back online.
        </p>
      )}

      <section aria-label={`Chat with ${other.name}`} className="flex flex-1 flex-col px-4 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}>
        {messages.length === 0 ? (
          <div className="m-auto max-w-[30ch] py-10 text-center">
            <Avatar name={other.name} size={72} src={other.avatar} className="mx-auto ring-0" />
            <p className="font-display mt-4 text-[22px] font-extrabold">You and {first} are connected</p>
            <p className="mt-2 text-[15px] text-soft">Say hi, or pick a plan to go to together. Only the two of you can read this chat.</p>
          </div>
        ) : (
          <ol className="mt-auto flex flex-col gap-1">
            {messages.map((m, i) => {
              const mine = m.sender_id === me;
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const at = new Date(m.created_at);
              const newDay = !prev || istDayKey(new Date(prev.created_at)) !== istDayKey(at);
              const grouped = next && next.sender_id === m.sender_id && istDayKey(new Date(next.created_at)) === istDayKey(at);
              return (
                <li key={m.id} className="flex flex-col">
                  {newDay && (
                    <p className="my-3 self-center rounded-full bg-card px-3 py-1 text-[12px] font-bold text-muted">{chatDay(at, now)}</p>
                  )}
                  <div className={`flex max-w-[82%] flex-col ${mine ? "items-end self-end" : "items-start self-start"} ${grouped ? "" : "mb-2"}`}>
                    <Bubble
                      mine={mine}
                      text={m.body}
                      dim={m.pending}
                      onLongPress={mine ? undefined : () => setReporting(m.id)}
                    />
                    {!grouped && !m.failed && (
                      <span className="mt-1 px-1 text-[11.5px] text-muted">
                        {m.pending ? "Sending…" : formatClock(at)}
                      </span>
                    )}
                    {m.failed && (
                      <button type="button" onClick={() => retry(m)} className="mt-1 min-h-8 px-1 text-[12.5px] font-bold text-warn">
                        {m.failed.startsWith("That didn't work") ? "Not sent. Tap to retry." : `Not sent. ${m.failed}`}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md items-end gap-2 border-t border-line/70 bg-paper/95 px-3 pt-2.5 backdrop-blur-md"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        <label htmlFor="chat-box" className="sr-only">
          Message {first}
        </label>
        <textarea
          id="chat-box"
          ref={boxRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Message ${first}`}
          maxLength={2000}
          aria-invalid={over || undefined}
          className="max-h-[132px] min-h-12 flex-1 resize-none rounded-[24px] border-[1.5px] border-line bg-card px-4 py-[11px] text-base leading-snug placeholder:text-muted/80 focus:border-thread focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || over}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-thread text-white transition-[transform,background-color] hover:bg-thread-deep active:scale-90 disabled:bg-line disabled:text-muted"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>

      <Sheet open={reporting !== null} onClose={() => setReporting(null)} label="Report message">
        {reporting && <ReportForm target={{ type: "message", id: reporting }} person={{ id: other.id, name: other.name }} onDone={() => setReporting(null)} />}
      </Sheet>
    </main>
  );
}

// Press and hold someone else's message to report it.
function Bubble({ mine, text, dim, onLongPress }: { mine: boolean; text: string; dim?: boolean; onLongPress?: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <p
      onPointerDown={onLongPress ? () => (timer.current = setTimeout(onLongPress, 550)) : undefined}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={
        onLongPress
          ? (e) => {
              e.preventDefault();
              onLongPress();
            }
          : undefined
      }
      className={`rounded-[22px] px-4 py-2.5 text-[16px] leading-snug break-words whitespace-pre-wrap select-text ${
        mine ? "rounded-br-[8px] bg-thread text-white" : "rounded-bl-[8px] bg-card text-ink"
      } ${dim ? "opacity-70" : ""}`}
    >
      {text}
    </p>
  );
}
