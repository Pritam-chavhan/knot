// Placeholder shapes while a signed-in page loads.
export default function Loading() {
  return (
    <main className="animate-pulse px-5 pt-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 rounded-full bg-line" />
      <div className="mt-3 h-8 w-56 rounded-full bg-line" />
      <div className="mt-6 h-44 rounded-[30px] bg-line" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="h-24 rounded-[24px] bg-line" />
        <div className="h-24 rounded-[24px] bg-line" />
      </div>
    </main>
  );
}
