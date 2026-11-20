"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button } from "@/components/ui";
import { removePhoto, uploadPhoto } from "./photo-actions";

const VIEW = 272; // crop circle, CSS px
const OUT = 768; // what we send; the server makes the final 512 px version
const MAX_FILE = 25 * 1024 * 1024;

type Crop = { bitmap: ImageBitmap; zoom: number; x: number; y: number };

export function PhotoPicker({ name, src }: { name: string; src: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "ok" } | null>(null);
  const [pending, start] = useTransition();

  const choose = () => fileRef.current?.click();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    if (!file.type.startsWith("image/")) return setMessage({ text: "That file isn't a photo. Choose a JPG, PNG or HEIC.", tone: "error" });
    if (file.size > MAX_FILE) return setMessage({ text: "That photo is over 25 MB. Choose a smaller one.", tone: "error" });
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (bitmap.width < 96 || bitmap.height < 96) {
        bitmap.close();
        return setMessage({ text: "That photo is too small. Choose one at least 96 px wide.", tone: "error" });
      }
      const s = VIEW / Math.min(bitmap.width, bitmap.height);
      setCrop({ bitmap, zoom: 1, x: (VIEW - bitmap.width * s) / 2, y: (VIEW - bitmap.height * s) / 2 });
      dialogRef.current?.showModal();
    } catch {
      setMessage({ text: "We couldn't open that photo. Try a JPG or PNG.", tone: "error" });
    }
  }

  function close() {
    dialogRef.current?.close();
    crop?.bitmap.close();
    setCrop(null);
  }

  async function save() {
    if (!crop) return;
    const { bitmap, zoom, x, y } = crop;
    const scale = (VIEW / Math.min(bitmap.width, bitmap.height)) * zoom;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, -x / scale, -y / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return setMessage({ text: "We couldn't prepare that photo. Try another one.", tone: "error" });
    close();
    const fd = new FormData();
    fd.append("photo", blob, "photo.jpg");
    start(async () => {
      const res = await uploadPhoto(fd);
      if (res.error) setMessage({ text: res.error, tone: "error" });
      else {
        setMessage({ text: "Photo updated.", tone: "ok" });
        router.refresh();
      }
    });
  }

  function remove() {
    setMessage(null);
    start(async () => {
      const res = await removePhoto();
      if (res.error) setMessage({ text: res.error, tone: "error" });
      else {
        setMessage({ text: "Photo removed.", tone: "ok" });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-[28px] bg-card p-5">
      <button
        type="button"
        onClick={choose}
        disabled={pending}
        className="group relative shrink-0 rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-thread"
        aria-label={src ? "Change your photo" : "Add a photo"}
      >
        <Avatar name={name} size={76} src={src} index={0} className="ring-paper" />
        <span
          aria-hidden="true"
          className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-thread text-white ring-[3px] ring-card transition-transform group-active:scale-90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
            <circle cx="12" cy="12.5" r="3.3" />
          </svg>
        </span>
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/55" aria-hidden="true">
            <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white motion-reduce:animate-none" />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Profile photo</p>
        <p className="text-[13px] leading-snug text-muted">Optional. Only IITGN students on KNOT can see it.</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" onClick={choose} disabled={pending} className="min-h-11 text-[14px] font-bold text-thread-deep underline-offset-4 hover:underline">
            {pending ? "Saving…" : src ? "Change" : "Add a photo"}
          </button>
          {src && !pending && (
            <button type="button" onClick={remove} className="min-h-11 text-[14px] font-bold text-warn underline-offset-4 hover:underline">
              Remove
            </button>
          )}
        </div>
        <p aria-live="polite" className={`text-[13px] font-medium ${message?.tone === "error" ? "text-warn" : "text-river-deep"}`}>
          {message?.text}
        </p>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        aria-labelledby="crop-title"
        className="m-auto w-[min(92vw,380px)] rounded-[30px] bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm"
      >
        {crop && <Cropper crop={crop} onChange={setCrop} onCancel={close} onSave={save} />}
      </dialog>
    </div>
  );
}

function Cropper({ crop, onChange, onCancel, onSave }: { crop: Crop; onChange: (c: Crop) => void; onCancel: () => void; onSave: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const { bitmap, zoom, x, y } = crop;
  const base = VIEW / Math.min(bitmap.width, bitmap.height);

  // Keep the photo covering the whole circle.
  const clamp = useCallback(
    (next: Crop): Crop => {
      const s = base * next.zoom;
      const w = bitmap.width * s;
      const h = bitmap.height * s;
      return { ...next, x: Math.min(0, Math.max(VIEW - w, next.x)), y: Math.min(0, Math.max(VIEW - h, next.y)) };
    },
    [base, bitmap],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = canvas.height = VIEW * dpr;
    const s = base * zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(bitmap, x, y, bitmap.width * s, bitmap.height * s);
  }, [bitmap, base, zoom, x, y]);

  function setZoom(z: number) {
    // Zoom around the centre of the circle.
    const c = VIEW / 2;
    const ratio = z / zoom;
    onChange(clamp({ ...crop, zoom: z, x: c - (c - x) * ratio, y: c - (c - y) * ratio }));
  }

  return (
    <div className="p-5">
      <h2 id="crop-title" className="font-display text-[22px] font-extrabold">
        Position your photo
      </h2>
      <p className="text-[14px] text-muted">Drag to move. Use the slider to zoom.</p>
      <div className="mt-4 flex justify-center">
        <div
          role="group"
          aria-label="Photo position. Use the arrow keys to move the photo."
          tabIndex={0}
          className="relative touch-none rounded-full outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-thread"
          style={{ width: VIEW, height: VIEW, cursor: drag.current ? "grabbing" : "grab" }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x, y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            onChange(clamp({ ...crop, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => setZoom(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)))}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 40 : 10;
            const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            const m = moves[e.key];
            if (!m) return;
            e.preventDefault();
            onChange(clamp({ ...crop, x: x + m[0], y: y + m[1] }));
          }}
        >
          <canvas ref={canvasRef} className="h-full w-full rounded-full bg-paper" style={{ width: VIEW, height: VIEW }} aria-hidden="true" />
          <span className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-thread/80" aria-hidden="true" />
        </div>
      </div>
      <label className="mt-5 flex items-center gap-3">
        <span className="text-sm font-semibold">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-11 flex-1 accent-thread"
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave}>
          Use photo
        </Button>
      </div>
    </div>
  );
}
