import Link from "next/link";

// The doorway to the live map. The little map is an illustration: the pins
// are made up, never real people. Only the number of people sharing with
// everyone right now is real.
export function WhosAroundCard({ live }: { live: number }) {
  return (
    <Link
      href="/map"
      className="group relative mt-5 block h-[176px] overflow-hidden rounded-[30px] bg-ink text-white transition-transform active:scale-[0.99]"
      aria-label={`Who's around: ${live === 0 ? "be the first to share your spot" : `${live} ${live === 1 ? "person is" : "people are"} sharing now`}`}
    >
      <svg aria-hidden="true" viewBox="0 0 360 176" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="wa-glow" cx="72%" cy="45%" r="60%">
            <stop offset="0" stopColor="#5A3DF0" stopOpacity="0.55" />
            <stop offset="1" stopColor="#17142B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="176" fill="url(#wa-glow)" />
        {/* The river and a few campus paths */}
        <path d="M292 -10 C 250 40, 300 90, 248 186" fill="none" stroke="#3B8C95" strokeOpacity="0.55" strokeWidth="26" strokeLinecap="round" />
        <path d="M150 176 C 190 130, 220 120, 360 112" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="3" />
        <path d="M200 0 C 205 60, 180 100, 210 176" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="3" />
        <path d="M120 60 L 360 40" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="2" />
        <circle cx="262" cy="88" r="72" fill="none" stroke="#9C8BFF" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="5 6" />
      </svg>

      {/* Pins */}
      <span aria-hidden="true">
        <Pin x="63%" y="24%" color="#FFB020" letter="A" delay="0s" />
        <Pin x="81%" y="50%" color="#FF7E9D" letter="M" delay="0.6s" />
        <Pin x="66%" y="64%" color="#7C66FF" letter="R" delay="1.2s" />
      </span>

      <span className="relative flex h-full flex-col justify-between p-5">
        <span>
          <span className="font-display block text-[26px] leading-none font-extrabold">Who&apos;s around</span>
          <span className="mt-1.5 block max-w-[17ch] text-[14px] leading-snug text-white/75">See friends on campus right now</span>
        </span>
        <span className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-bold backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              {live > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-70 motion-reduce:animate-none" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${live > 0 ? "bg-[#4ADE80]" : "bg-white/50"}`} />
            </span>
            {live === 0 ? "Be the first to share" : `${live} sharing now`}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-0.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </span>
        </span>
      </span>
    </Link>
  );
}

function Pin({ x, y, color, letter, delay }: { x: string; y: string; color: string; letter: string; delay: string }) {
  return (
    <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
      <span
        className="absolute inset-0 rounded-full motion-safe:animate-[pin-ping_2.4s_ease-out_infinite]"
        style={{ background: color, animationDelay: delay }}
      />
      <span
        className="relative flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] border-white text-[14px] font-extrabold text-ink shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
        style={{ background: color }}
      >
        {letter}
      </span>
    </span>
  );
}
