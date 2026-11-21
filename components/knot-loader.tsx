// The KNOT knot drawing itself, for pages that take a moment to load. It
// fades in only after a quarter of a second, so quick loads show nothing.
const STRANDS = [
  "M41.3 44.2 L39.4 47.3 L37.8 50.5 L36.6 53.8 L35.6 57.2 L35.0 60.7 L34.7 64.0 L34.8 67.3 L35.1 70.4 L35.8 73.4 L36.7 76.2 L38.0 78.6 L39.5 80.8 L41.1 82.7 L43.0 84.2 L45.0 85.3 L47.1 86.1 L49.2 86.4 L51.4 86.4 L53.5 85.9 L55.6 85.0 L57.6 83.8 L59.4 82.1 L61.0 80.1 L62.4 77.9 L63.5 75.3 L64.4 72.4",
  "M61.1 48.3 L59.3 45.2 L57.3 42.2 L55.0 39.4 L52.5 36.9 L49.9 34.7 L47.1 32.7 L44.3 31.1 L41.4 29.9 L38.5 29.0 L35.6 28.4 L32.8 28.2 L30.2 28.4 L27.7 28.9 L25.5 29.8 L23.5 31.0 L21.8 32.4 L20.5 34.1 L19.4 36.0 L18.8 38.1 L18.5 40.3 L18.6 42.6 L19.1 45.0 L20.0 47.4 L21.3 49.8 L23.0 52.0 L25.0 54.2",
  "M47.5 63.4 L51.2 63.4 L54.8 63.2 L58.3 62.6 L61.7 61.7 L65.0 60.6 L68.0 59.1 L70.8 57.4 L73.4 55.6 L75.6 53.5 L77.5 51.3 L79.1 49.0 L80.2 46.6 L81.0 44.2 L81.4 41.9 L81.4 39.6 L81.0 37.4 L80.2 35.3 L79.0 33.5 L77.6 31.9 L75.8 30.5 L73.7 29.5 L71.4 28.7 L68.9 28.3 L66.2 28.3 L63.4 28.6 L60.5 29.2"
];

export function KnotLoader({ label = "Loading", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center opacity-0 animate-[knot-appear_300ms_ease-out_250ms_forwards] motion-reduce:opacity-100 motion-reduce:animate-none ${fullScreen ? "min-h-dvh" : "min-h-[70dvh]"}`}
    >
      <span className="sr-only">{label}…</span>
      <span aria-hidden="true" className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-thread/15 motion-safe:animate-[knot-glow_2.4s_ease-in-out_infinite]" />
        <svg viewBox="14 24 72 66" className="relative h-20 w-20" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
          {STRANDS.map((d, i) => (
            <path key={i} d={d} pathLength={1} className="knot-strand text-thread" style={{ animationDelay: `${i * 0.35}s` }} />
          ))}
        </svg>
      </span>
      <p className="mt-5 text-[15px] font-semibold text-soft">Getting things ready…</p>
      <p className="mt-1 max-w-[30ch] text-[13px] text-muted opacity-0 animate-[knot-appear_400ms_ease-out_4s_forwards] motion-reduce:hidden">
        Still loading. Campus Wi-Fi can be slow; hang tight.
      </p>
    </div>
  );
}
