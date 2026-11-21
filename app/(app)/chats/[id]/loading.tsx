// A chat while it loads: header, a few bubbles, the message box.
export default function Loading() {
  return (
    <main className="-mb-32 flex min-h-dvh animate-pulse flex-col motion-reduce:animate-none" aria-busy="true" aria-label="Loading chat">
      <div className="flex items-center gap-3 border-b border-line/70 px-4 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <div className="h-11 w-11 rounded-full bg-line" />
        <div className="h-[42px] w-[42px] rounded-full bg-line" />
        <div className="h-4 w-36 rounded-full bg-line" />
      </div>
      <div className="mt-auto flex flex-col gap-2 px-4 pb-28">
        <div className="h-10 w-48 rounded-[22px] bg-line" />
        <div className="h-10 w-56 self-end rounded-[22px] bg-line" />
        <div className="h-10 w-40 rounded-[22px] bg-line" />
      </div>
    </main>
  );
}
