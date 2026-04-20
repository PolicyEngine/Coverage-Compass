import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'Backend not configured. Set BACKEND_URL environment variable.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    // Modal URLs are the endpoint directly, Cloud Run needs /api/simulate suffix
    const url = BACKEND_URL.includes('modal.run')
      ? BACKEND_URL
      : `${BACKEND_URL}/api/simulate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Backend request failed');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to simulate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
