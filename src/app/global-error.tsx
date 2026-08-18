"use client";

import { useEffect } from "react";

// global-error replaces the root layout entirely, so it cannot rely on
// globals.css tokens or next/font — everything here is inlined and uses
// system fonts to stay renderable even if the rest of the app failed to load.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[aurelia] root render error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "#050505",
          color: "#d7f5fb",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "11px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#5b7480",
          }}
        >
          Critical Fault
        </div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          AURELIA failed to start
        </h1>
        <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#5b7480" }}>
          The dashboard hit an error before it could render. Try reloading —
          if it persists, check the console for details.
        </p>
        {error.digest && (
          <p
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "11px",
              color: "#5b7480",
            }}
          >
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={() => retry()}
          style={{
            marginTop: "0.5rem",
            border: "1px solid #f43f5e",
            background: "transparent",
            color: "#f43f5e",
            padding: "0.5rem 1rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
