"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
import { BackButton } from "@/components/back-button";
import { browserClient } from "@/lib/supabase/browser";
import { avatarSrc } from "@/lib/avatar";
import { formatClock } from "@/lib/time";
import { ago, DURATIONS, geoError, mapError, metres, minutesLeft, type Bounds, type MapPerson, type Sharing, type Wave } from "./types";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e8e4da]" aria-hidden="true" />,
});

const POLL_MS = 15_000;
const MIN_SEND_MS = 12_000;
const MAX_QUIET_MS = 60_000;
const MOVE_M = 15;

type Pos = { lat: number; lng: number; accuracy: number };

export function MapScreen({ bounds, initialSharing, me }: { bounds: Bounds | null; initialSharing: Sharing | null; me: { id: string } }) {
  const [sharing, setSharing] = useState<Sharing | null>(initialSharing);
  const [pos, setPos] = useState<Pos | null>(null);
  const [people, setPeople] = useState<MapPerson[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);

  // Ask for a fresh, accurate position.
  const locate = () =>
    new Promise<Pos>((resolve, reject) => {
      if (!("geolocation" in navigator)) return reject(new Error("This browser can't share location."));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        (e) => reject(new Error(geoError(e))),
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
      );
    });

  const refresh = useCallback(async () => {
    const supabase = browserClient();
    if (!supabase) return;
    const [p, w] = await Promise.all([supabase.rpc("map_people"), supabase.rpc("my_waves")]);
    if (!p.error) {
      setPeople(
        ((p.data ?? []) as { profile_id: string; display_name: string | null; programme: string | null; avatar_path: string | null; lat: number; lng: number; precise: boolean; updated_at: string; connected: boolean }[]).map((r) => ({
          id: r.profile_id,
          name: r.display_name ?? "Student",
          programme: r.programme,
          avatar: avatarSrc(r.profile_id, r.avatar_path),
          lat: r.lat,
          lng: r.lng,
          precise: r.precise,
          updatedAt: r.updated_at,
          connected: r.connected,
        })),
      );
    }
    if (!w.error) {
      setWaves(
        ((w.data ?? []) as { wave_id: string; from_id: string; display_name: string | null; avatar_path: string | null; created_at: string; visible: boolean }[]).map((r) => ({
          id: r.wave_id,
          fromId: r.from_id,
          name: r.display_name ?? "Student",
          avatar: avatarSrc(r.from_id, r.avatar_path),
          at: r.created_at,
          visible: r.visible,
        })),
      );
    }
  }, []);

  const ended = useCallback((why: string) => {
    setSharing(null);
    setPeople([]);
    setSelected(null);
    lastSent.current = null;
    setNotice(why);
  }, []);

  // While sharing: follow the phone's position, send moves, and check who's around.
  useEffect(() => {
    if (!sharing) return;
    const supabase = browserClient();
    if (!supabase) return;
    let watch: number | null = null;

    const send = async (p: Pos) => {
      const last = lastSent.current;
      const t = Date.now();
      if (last && t - last.at < MIN_SEND_MS) return;
      if (last && metres(last, p) < MOVE_M && t - last.at < MAX_QUIET_MS) return;
      lastSent.current = { at: t, lat: p.lat, lng: p.lng };
      const { data, error } = await supabase.rpc("update_location", { p_lat: p.lat, p_lng: p.lng, p_accuracy: Math.round(p.accuracy) });
      if (error) return;
      const r = data as { stopped?: string } & Partial<Sharing>;
      if (r.stopped === "off_campus") ended("You left campus, so sharing stopped.");
      else if (r.stopped) ended("Sharing ended.");
    };

    if ("geolocation" in navigator) {
      watch = navigator.geolocation.watchPosition(
        (p) => {
          const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
          setPos(next);
          void send(next);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
      );
    }
    void refresh();
    const poll = setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sharing, refresh, ended]);

  // Countdown, and stop when the time is up.
  useEffect(() => {
    if (!sharing) return;
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (new Date(sharing.expires_at).getTime() <= t) ended(`Your sharing ended at ${formatClock(new Date(sharing.expires_at))}.`);
    }, 15_000);
    return () => clearInterval(tick);
  }, [sharing, ended]);

  // Waves can still arrive when you're not sharing.
  useEffect(() => {
    if (sharing) return;
    void refresh();
  }, [sharing, refresh]);

  async function start(minutes: number, visibility: "connections" | "campus", precise: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      const p = await locate();
      setPos(p);
      const supabase = browserClient();
      if (!supabase) throw new Error("That didn't work. Check your connection and try again.");
      const { data, error } = await supabase.rpc("start_sharing", {
        p_lat: p.lat,
        p_lng: p.lng,
        p_accuracy: Math.round(p.accuracy),
        p_minutes: minutes,
        p_visibility: visibility,
        p_precise: precise,
      });
      if (error) throw new Error(mapError(error));
      lastSent.current = { at: Date.now(), lat: p.lat, lng: p.lng };
      setNow(Date.now());
      setSharing(data as Sharing);
      setRecenter((n) => n + 1);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    await browserClient()?.rpc("stop_sharing");
    setBusy(false);
    ended("You've stopped sharing. Your spot is gone from the map.");
  }

  async function wave(id: string) {
    const { error } = (await browserClient()?.rpc("send_wave", { p_to: id })) ?? { error: { message: "" } };
    return error ? mapError(error) : null;
  }

  if (!bounds) {
    return (
      <main className="px-5 pt-6">
        <BackButton fallback="/discover" />
        <h1 className="font-display mt-4 text-[30px] font-extrabold">Campus map</h1>
        <p className="mt-2 text-soft">The map isn&apos;t set up for your college yet.</p>
      </main>
    );
  }

  const person = people.find((p) => p.id === selected) ?? null;
  const left = sharing ? minutesLeft(sharing.expires_at, now) : 0;

  return (
    <main className="fixed inset-x-0 top-0 bottom-0 z-0 mx-auto w-full max-w-md overflow-hidden">
      <h1 className="sr-only">Campus map</h1>
      <div className="absolute inset-0">
        <CampusMap
          bounds={bounds}
          me={sharing && pos ? { lat: pos.lat, lng: pos.lng, precise: sharing.precise } : null}
          people={sharing ? people : []}
          selected={selected}
          onSelect={setSelected}
          recenter={recenter}
        />
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start gap-2 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}>
        <div className="pointer-events-auto rounded-full shadow-[0_4px_16px_rgba(23,20,43,0.18)]">
          <BackButton fallback="/discover" />
        </div>
        {sharing ? (
          <div className="pointer-events-auto flex min-h-11 flex-1 items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-white shadow-[0_4px_16px_rgba(23,20,43,0.25)]" role="status">
            <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
              Sharing · {left <= 1 ? "1 min" : `${left} min`} left
            </span>
            <button type="button" onClick={stop} disabled={busy} className="min-h-9 rounded-full bg-white px-4 text-[14px] font-extrabold text-ink transition-transform active:scale-95 disabled:opacity-60">
              Stop
            </button>
          </div>
        ) : (
          <p className="pointer-events-auto flex min-h-11 items-center rounded-full bg-card px-4 text-[15px] font-extrabold shadow-[0_4px_16px_rgba(23,20,43,0.18)]">Who&apos;s around</p>
        )}
      </div>

      {sharing && pos && (
        <button
          type="button"
          onClick={() => setRecenter((n) => n + 1)}
          aria-label="Show my spot"
          className="absolute right-4 z-[500] flex h-12 w-12 items-center justify-center rounded-full bg-card text-thread shadow-[0_4px_16px_rgba(23,20,43,0.18)] transition-transform active:scale-90"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 300px)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
          </svg>
        </button>
      )}

      {/* Bottom panel, above the tab bar */}
      <div className="absolute inset-x-0 z-[500] px-3" style={{ bottom: "calc(env(safe-area-inset-bottom) + 100px)" }}>
        {notice && (
          <p role="alert" className="mb-2 rounded-[20px] bg-ink px-4 py-3 text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(23,20,43,0.25)]">
            {notice}
          </p>
        )}
        {waves.length > 0 && !person && <WaveList waves={waves} sharing={!!sharing} onShow={(id) => setSelected(id)} onWave={wave} />}
        {person ? (
          <PersonCard person={person} now={now} onClose={() => setSelected(null)} onWave={wave} />
        ) : sharing ? (
          <SharingSummary sharing={sharing} count={people.length} />
        ) : (
          <SharePanel busy={busy} onStart={start} meId={me.id} />
        )}
      </div>
    </main>
  );
}

function Panel({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section aria-label={label} className="rounded-[28px] bg-card p-4 shadow-[0_10px_30px_rgba(23,20,43,0.22)]">
      {children}
    </section>
  );
}

function SharePanel({ busy, onStart }: { busy: boolean; onStart: (m: number, v: "connections" | "campus", p: boolean) => void; meId: string }) {
  const [minutes, setMinutes] = useState(30);
  const [visibility, setVisibility] = useState<"connections" | "campus">("campus");
  const [precise, setPrecise] = useState(true);
  const seg = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-full px-2 text-[14px] font-bold transition-colors ${on ? "bg-ink text-white" : "text-soft hover:text-ink"}`;
  return (
    <Panel label="Share your spot">
      <h2 className="font-display text-[22px] leading-tight font-extrabold">See who&apos;s around</h2>
      <p className="mt-1 text-[14px] text-soft">Share your spot to see classmates who are sharing too. Nobody sees you unless you share.</p>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-[13px] font-bold">For</legend>
        <div className="flex gap-1 rounded-full bg-paper p-1">
          {DURATIONS.map((d) => (
            <label key={d.minutes} className={seg(minutes === d.minutes)}>
              <input type="radio" name="minutes" className="sr-only" checked={minutes === d.minutes} onChange={() => setMinutes(d.minutes)} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-[13px] font-bold">Who can see you</legend>
        <div className="flex gap-1 rounded-full bg-paper p-1">
          <label className={seg(visibility === "campus")}>
            <input type="radio" name="visibility" className="sr-only" checked={visibility === "campus"} onChange={() => setVisibility("campus")} />
            Everyone at IITGN
          </label>
          <label className={seg(visibility === "connections")}>
            <input type="radio" name="visibility" className="sr-only" checked={visibility === "connections"} onChange={() => setVisibility("connections")} />
            Connections
          </label>
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-[13px] font-bold">How exact</legend>
        <div className="flex gap-1 rounded-full bg-paper p-1">
          <label className={seg(precise)}>
            <input type="radio" name="precise" className="sr-only" checked={precise} onChange={() => setPrecise(true)} />
            Exact spot
          </label>
          <label className={seg(!precise)}>
            <input type="radio" name="precise" className="sr-only" checked={!precise} onChange={() => setPrecise(false)} />
            Rough area
          </label>
        </div>
      </fieldset>

      <Button type="button" className="mt-4 w-full" disabled={busy} onClick={() => onStart(minutes, visibility, precise)}>
        {busy ? "Finding you…" : "Share my spot"}
      </Button>
      <p className="mt-2 text-center text-[12.5px] text-muted">Campus only. Stops on its own, or when you leave campus. No history is kept.</p>
    </Panel>
  );
}

function SharingSummary({ sharing, count }: { sharing: Sharing; count: number }) {
  return (
    <Panel label="Sharing">
      <p className="font-display text-[20px] leading-tight font-extrabold">
        {count === 0 ? "No one else is sharing yet" : count === 1 ? "1 person around" : `${count} people around`}
      </p>
      <p className="mt-1 text-[14px] text-soft">
        {count === 0 ? "People appear here as they start. " : "Tap a photo to wave or see their profile. "}
        Visible to {sharing.visibility === "campus" ? "everyone at IITGN" : "your connections"}, {sharing.precise ? "exact spot" : "rough area"}. Stops at{" "}
        {formatClock(new Date(sharing.expires_at))}.
      </p>
    </Panel>
  );
}

function PersonCard({ person, now, onClose, onWave }: { person: MapPerson; now: number; onClose: () => void; onWave: (id: string) => Promise<string | null> }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState<string | null>(null);
  const first = person.name.split(" ")[0];
  return (
    <Panel label={person.name}>
      <div className="flex items-center gap-3">
        <Avatar name={person.name} size={56} src={person.avatar} className="ring-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-extrabold">{person.name}</p>
          <p className="truncate text-[13px] text-muted">
            {[person.connected ? "Connection" : person.programme, person.precise ? "Exact spot" : "Rough area", ago(person.updatedAt, now)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-paper">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={state !== "idle"}
          onClick={async () => {
            setState("sending");
            const e = await onWave(person.id);
            setErr(e);
            setState(e ? "idle" : "sent");
          }}
        >
          {state === "sent" ? `Waved at ${first}` : state === "sending" ? "Waving…" : <>👋 Wave</>}
        </Button>
        <Link href={`/people/${person.id}`} className="flex min-h-[52px] flex-1 items-center justify-center rounded-full border-[1.5px] border-line text-[16px] font-bold transition-transform active:scale-[0.98]">
          Profile
        </Link>
      </div>
      {err && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-warn">
          {err}
        </p>
      )}
    </Panel>
  );
}

function WaveList({ waves, sharing, onShow, onWave }: { waves: Wave[]; sharing: boolean; onShow: (id: string) => void; onWave: (id: string) => Promise<string | null> }) {
  const [waved, setWaved] = useState<Record<string, boolean>>({});
  const w = waves[0];
  const others = waves.length - 1;
  return (
    <section aria-label="Waves" className="mb-2 flex items-center gap-3 rounded-[24px] bg-marigold-tint p-3 shadow-[0_6px_20px_rgba(23,20,43,0.16)]">
      <Avatar name={w.name} size={44} src={w.avatar} className="ring-0" />
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        <span className="font-extrabold">{w.name.split(" ")[0]}</span> waved at you
        {others > 0 && <span className="text-soft"> (and {others} more)</span>}
        {!sharing && <span className="block text-[12.5px] text-soft">Share your spot to see where they are.</span>}
      </p>
      {sharing && w.visible && (
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onShow(w.fromId)} className="min-h-11 rounded-full bg-card px-3 text-[13px] font-bold">
            Show
          </button>
          <button
            type="button"
            disabled={waved[w.fromId]}
            onClick={async () => {
              const e = await onWave(w.fromId);
              if (!e) setWaved((s) => ({ ...s, [w.fromId]: true }));
            }}
            className="min-h-11 rounded-full bg-ink px-3 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {waved[w.fromId] ? "Waved" : "Wave back"}
          </button>
        </div>
      )}
    </section>
  );
}
