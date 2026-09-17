"use client"

/** Replaces the whole document, so it's styled inline: the stylesheet may be what broke. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100svh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1rem", fontWeight: 600 }}>
          Stayfinder could not start
        </h1>
        <p style={{ fontSize: "0.8rem", maxWidth: "40ch", opacity: 0.75 }}>
          An unexpected error broke the application shell.
          {error.digest ? ` Reference: ${error.digest}.` : ""}
        </p>
        <button
          onClick={reset}
          style={{
            border: "1px solid currentColor",
            padding: "0.4rem 0.9rem",
            fontSize: "0.8rem",
            cursor: "pointer",
            background: "transparent",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  )
}
