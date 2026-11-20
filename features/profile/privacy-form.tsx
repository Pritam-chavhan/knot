"use client";

import { useActionState } from "react";
import { savePrivacy, type PrivacyFormState } from "./actions";
import { Button, Toggle } from "@/components/ui";

export function PrivacyForm({ showGoing, allowRequests }: { showGoing: boolean; allowRequests: boolean }) {
  const [state, action, pending] = useActionState<PrivacyFormState, FormData>(savePrivacy, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-[28px] bg-card p-5">
      <Toggle
        name="showGoing"
        defaultChecked={showGoing}
        title="Show me as going by default"
        description="Others going to the same event can see you."
      />
      <div className="h-px bg-line" />
      <Toggle name="allowRequests" defaultChecked={allowRequests} title="Allow requests to connect" description="Turn off to stop all new requests." />
      <div aria-live="polite">
        {state.error && (
          <p role="alert" className="text-sm font-medium text-warn">
            {state.error}
          </p>
        )}
        {state.saved && <p className="text-sm font-semibold text-river-deep">Privacy settings saved.</p>}
      </div>
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? "Saving…" : "Save privacy settings"}
      </Button>
    </form>
  );
}
