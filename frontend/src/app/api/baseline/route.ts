import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backendProxy';

// Warm-up calls hit the same slow backend as simulate; keep the same budget.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  return proxyToBackend(request, 'baseline', 'Failed to fetch baseline');
}
