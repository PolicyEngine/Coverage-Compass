import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL;

// PolicyEngine simulations regularly take 30-60s on a Modal cold start.
// Give the backend fetch a hard deadline below the route's maxDuration so
// we can return a friendly timeout message instead of a platform error.
export const BACKEND_TIMEOUT_MS = 110_000;

/**
 * Proxy a POST body to the Flask/Modal backend and normalize errors.
 *
 * Guarantees the client always receives JSON with an `error` string on
 * failure — never raw HTML from a gateway or a platform timeout page.
 */
export async function proxyToBackend(
  request: NextRequest,
  path: 'simulate' | 'baseline',
  fallbackMessage: string,
): Promise<NextResponse> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'Backend not configured. Set BACKEND_URL environment variable.' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    // Modal URLs are the endpoint directly, Cloud Run needs the /api suffix
    const url = BACKEND_URL.includes('modal.run')
      ? BACKEND_URL
      : `${BACKEND_URL}/api/${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      // Error bodies from gateways (502/504) are often HTML — only parse
      // JSON when the backend says it's JSON, and never leak raw bodies.
      let message = `The simulation service returned an error (HTTP ${response.status}). Please try again.`;
      if (contentType.includes('application/json')) {
        try {
          const err = await response.json();
          if (typeof err?.error === 'string') message = err.error;
        } catch {
          // fall through to the generic message
        }
      }
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: fallbackMessage }, { status: 502 });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json(
        {
          error:
            'The simulation took too long to respond. The service may be starting up — please try again in a moment.',
        },
        { status: 504 },
      );
    }
    const message = error instanceof Error ? error.message : fallbackMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
