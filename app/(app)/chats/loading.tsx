// The Chats list while it loads.
export default function Loading() {
  return (
    <main className="animate-pulse px-5 pt-6 motion-reduce:animate-none" aria-busy="true" aria-label="Loading chats">
      <div className="h-9 w-32 rounded-full bg-line" />
      <div className="mt-3 h-4 w-64 rounded-full bg-line" />
      <div className="mt-5 h-16 rounded-[24px] bg-line" />
      <ul className="mt-6 flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-3.5">
            <div className="h-[54px] w-[54px] shrink-0 rounded-full bg-line" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded-full bg-line" />
              <div className="mt-2 h-3.5 w-48 rounded-full bg-line" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
