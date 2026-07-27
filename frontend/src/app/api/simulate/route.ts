import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backendProxy';

// PolicyEngine sims + Modal cold starts can take over a minute; without
// this the platform default duration kills the function mid-simulation.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  return proxyToBackend(request, 'simulate', 'Failed to simulate');
}
