"use client";

import { useState } from "react";
import type { DayPoint } from "./queries";

// Daily sign-ups (marigold bars) and daily active students (violet line) on
// one shared count axis. Tap or hover a day for its numbers; a table view
// covers screen readers and anyone who can't tell the colours apart.
const W = 340;
const H = 150;
const PAD = { l: 26, r: 6, t: 10, b: 20 };
const SIGNUP = "#E89A00";
const ACTIVE = "#5A3DF0";

const short = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function ActivityChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...data.map((d) => Math.max(d.signups, d.active)));
  const top = Math.ceil(max / 4) * 4;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = iw / data.length;
  const x = (i: number) => PAD.l + i * step + step / 2;
  const y = (v: number) => PAD.t + ih - (v / top) * ih;
  const bw = Math.max(3, step - 4);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.active).toFixed(1)}`).join(" ");
  const ticks = [0, top / 2, top];
  const h = hover === null ? data.length - 1 : hover;
  const sel = data[h];

  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-soft" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SIGNUP }} /> Sign-ups
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded-full" style={{ background: ACTIVE }} /> Active students
        </span>
        <span className="ml-auto font-semibold text-ink">
          {short(sel.day)}: {sel.signups} sign-up{sel.signups === 1 ? "" : "s"}, {sel.active} active
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block h-auto w-full touch-none"
        role="img"
        aria-label="Daily sign-ups and active students over the last 30 days. Table below."
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#E2E1EA" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9" fill="#6C6880">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const bh = Math.max(0, PAD.t + ih - y(d.signups));
          return (
            <g key={d.day}>
              {d.signups > 0 && (
                <path
                  d={`M${x(i) - bw / 2} ${PAD.t + ih} v${-Math.max(0, bh - 2)} q0 -2 2 -2 h${bw - 4} q2 0 2 2 v${Math.max(0, bh - 2)} z`}
                  fill={SIGNUP}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
        <path d={line} fill="none" stroke={ACTIVE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#17142B" strokeOpacity="0.25" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(data[hover].active)} r="4" fill={ACTIVE} stroke="#fff" strokeWidth="2" />
          </>
        )}
        <text x={PAD.l} y={H - 5} fontSize="9" fill="#6C6880">
          {short(data[0].day)}
        </text>
        <text x={W - PAD.r} y={H - 5} fontSize="9" fill="#6C6880" textAnchor="end">
          Today
        </text>
        {data.map((d, i) => (
          <rect
            key={`hit-${d.day}`}
            x={PAD.l + i * step}
            y={PAD.t}
            width={step}
            height={ih}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          />
        ))}
      </svg>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-[13px] font-bold text-thread">Show as a table</summary>
        <div className="max-h-64 overflow-y-auto rounded-2xl bg-paper">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="px-3 py-2 font-semibold">Day</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Sign-ups</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Active</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-1.5">{short(d.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.signups}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
