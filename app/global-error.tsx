"use client";

// Last-resort screen if the root layout itself fails. It can't use the app's
// fonts or styles, so it stays plain.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f2f3f7", color: "#17142b", padding: 24 }}>
        <h1 style={{ fontSize: 28 }}>KNOT didn&apos;t load</h1>
        <p>Check your connection and try again.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", borderRadius: 999, border: 0, background: "#5a3df0", color: "#fff", fontWeight: 700 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
