// The People screen while it loads.
export default function Loading() {
  return (
    <main className="animate-pulse px-5 pt-6 motion-reduce:animate-none" aria-busy="true" aria-label="Loading people">
      <div className="h-11 w-11 rounded-full bg-line" />
      <div className="mt-3 h-9 w-36 rounded-full bg-line" />
      <div className="mt-5 h-13 rounded-full bg-line" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-56 rounded-[24px] bg-line" />
        ))}
      </div>
    </main>
  );
}
