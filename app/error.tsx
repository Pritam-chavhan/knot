"use client";

import { useEffect } from "react";
import { Button, KnotMark, Logo } from "@/components/ui";

// Shown when a page fails to load. The digest lets us find the server log.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-6 pb-10">
      <Logo />
      <div className="my-auto">
        <KnotMark size={96} className="text-rose" />
        <h1 className="font-display mt-6 text-[36px] leading-[1.02] font-extrabold">This page didn&apos;t load</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-soft">
          Check your connection and try again. If it keeps happening, tell us the code below.
        </p>
        {error.digest && <p className="mt-3 text-[13px] text-muted">Code: {error.digest}</p>}
        <Button onClick={reset} className="mt-8 h-14 w-full">
          Try again
        </Button>
      </div>
    </main>
  );
}
