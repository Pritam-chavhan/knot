"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/ui";
import { unblockPerson, type ChatActionState } from "./actions";

export function BlockedList({ people }: { people: { profile_id: string; display_name: string | null }[] }) {
  return (
    <section className="mt-4 rounded-[28px] bg-card p-5" aria-labelledby="blocked-h">
      <h3 id="blocked-h" className="font-bold">
        Blocked people
      </h3>
      {people.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted">No one. Block someone from their profile or your chat, using the ⋯ menu.</p>
      ) : (
        <>
          <p className="mt-1 text-[14px] text-muted">You can&apos;t see each other anywhere on KNOT. They aren&apos;t told.</p>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {people.map((p) => (
              <BlockedRow key={p.profile_id} id={p.profile_id} name={p.display_name ?? "Student"} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function BlockedRow({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(unblockPerson, {});
  return (
    <li className="py-2.5">
      <form action={action} className="flex items-center gap-3">
        <Avatar name={name} size={40} className="ring-0" />
        <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
        <input type="hidden" name="person" value={id} />
        <button type="submit" disabled={pending} className="min-h-11 rounded-full border border-line px-4 text-[14px] font-bold transition-colors hover:border-ink/30 disabled:opacity-60">
          {pending ? "Unblocking…" : `Unblock ${name.split(" ")[0]}`}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-1 text-sm font-medium text-warn">
          {state.error}
        </p>
      )}
    </li>
  );
}
