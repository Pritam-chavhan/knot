"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { blockPerson, removeConnection, type ChatActionState } from "./actions";
import { ReportForm } from "./report-form";
import { ICONS, Sheet, SheetOption } from "./sheet";

type Step = "menu" | "report" | "block" | "remove";

// The "more" menu on a profile or a chat: report, block, remove connection.
export function PersonMenu({
  person,
  reportTarget,
  connected = false,
  from,
}: {
  person: { id: string; name: string };
  // What a report from this menu is about: the profile, or the latest message.
  reportTarget: { type: "profile" | "message"; id: string };
  connected?: boolean;
  from: "profile" | "chat";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const router = useRouter();
  const first = person.name.split(" ")[0];
  const close = () => {
    setOpen(false);
    setStep("menu");
  };

  return (
    <>
      <button
        type="button"
        aria-label={`More options for ${first}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-card transition-transform active:scale-90"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      <Sheet open={open} onClose={close} label={step === "menu" ? `Options for ${first}` : step === "report" ? "Report" : step === "block" ? `Block ${first}` : "Remove connection"}>
        {step === "menu" && (
          <div className="flex flex-col">
            <p className="font-display px-3 pb-2 text-[18px] font-extrabold">{person.name}</p>
            {from === "chat" && (
              <SheetOption icon={ICONS.person} onClick={() => router.push(`/people/${person.id}`)}>
                View profile
              </SheetOption>
            )}
            <SheetOption icon={ICONS.flag} onClick={() => setStep("report")}>
              Report {from === "chat" ? "chat" : "profile"}
            </SheetOption>
            {connected && (
              <SheetOption icon={ICONS.unlink} onClick={() => setStep("remove")}>
                Remove connection
              </SheetOption>
            )}
            <SheetOption icon={ICONS.block} tone="warn" onClick={() => setStep("block")}>
              Block {first}
            </SheetOption>
            <Button type="button" variant="ghost" className="mt-3" onClick={close}>
              Close
            </Button>
          </div>
        )}
        {step === "report" && <ReportForm target={reportTarget} person={person} onDone={close} />}
        {step === "block" && <BlockConfirm person={person} first={first} then={from === "chat" ? "/chats" : "/discover"} onCancel={close} />}
        {step === "remove" && <RemoveConfirm person={person} first={first} onCancel={close} />}
      </Sheet>
    </>
  );
}

function BlockConfirm({ person, first, then, onCancel }: { person: { id: string }; first: string; then: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(blockPerson, {});
  return (
    <form action={action}>
      <h2 className="font-display text-[22px] font-extrabold">Block {first}?</h2>
      <ul className="mt-3 flex flex-col gap-2 text-[15px] text-soft">
        <li>You won&apos;t see each other&apos;s profiles, plans or names on events.</li>
        <li>Your chat closes and neither of you can message the other.</li>
        <li>{first} isn&apos;t told. You can unblock from your profile settings.</li>
      </ul>
      <input type="hidden" name="person" value={person.id} />
      <input type="hidden" name="then" value={then} />
      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-warn">
          {state.error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" className="flex-1" disabled={pending}>
          {pending ? "Blocking…" : `Block ${first}`}
        </Button>
      </div>
    </form>
  );
}

function RemoveConfirm({ person, first, onCancel }: { person: { id: string }; first: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(removeConnection, {});
  return (
    <form action={action}>
      <h2 className="font-display text-[22px] font-extrabold">Remove {first} as a connection?</h2>
      <p className="mt-2 text-[15px] text-soft">Your chat is deleted for both of you. You can send a new request later.</p>
      <input type="hidden" name="person" value={person.id} />
      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-warn">
          {state.error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
          Keep
        </Button>
        <Button type="submit" variant="danger" className="flex-1" disabled={pending}>
          {pending ? "Removing…" : "Remove"}
        </Button>
      </div>
    </form>
  );
}
