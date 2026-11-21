"use client";

import { useEffect, useRef } from "react";

// A bottom sheet on the native <dialog>: focus moves in and stays inside,
// Escape and a tap outside close it, and the page behind can't be used.
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-card px-5 pt-2.5 text-ink backdrop:bg-ink/55 open:animate-[sheet-up_220ms_cubic-bezier(.2,.8,.2,1)] motion-reduce:open:animate-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
    >
      <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-line" />
      {open && children}
    </dialog>
  );
}

export function SheetOption({
  onClick,
  icon,
  children,
  tone = "default",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3.5 rounded-[18px] px-3 text-left text-[16px] font-semibold transition-colors hover:bg-paper active:scale-[0.99] ${tone === "warn" ? "text-warn" : "text-ink"}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon}
      </svg>
      {children}
    </button>
  );
}

export const ICONS = {
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c.8-3.9 3.8-6.2 7.5-6.2s6.7 2.3 7.5 6.2" />
    </>
  ),
  flag: <path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5" />,
  block: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  unlink: <path d="M9.5 14.5l5-5M10 6.5l1.6-1.6a4 4 0 0 1 5.6 5.6L15.6 12M14 17.5l-1.6 1.6a4 4 0 0 1-5.6-5.6L8.4 12M4 4l16 16" />,
};
