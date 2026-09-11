'use client';

/**
 * Last-resort boundary: catches errors thrown in the root layout itself, which
 * app/error.tsx cannot reach. It must render its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
          Something went wrong
        </h1>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#475569' }}>
          The application failed to start.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 0,
            background: '#2244e9',
            color: '#fff',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
