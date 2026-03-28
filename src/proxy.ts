import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic in-memory rate limiting for Edge Middleware
// Note: In a serverless/edge environment, this state is per-isolate.
// Since we have a strict "no storage" constraint, this serves as basic protection.
type RateLimitInfo = {
  count: number;
  resetAt: number;
};

const ipMap = new Map<string, RateLimitInfo>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute

export default function proxy(request: NextRequest) {
  // Only apply to the calendar generation endpoint
  if (request.nextUrl.pathname.startsWith('/api/calendar')) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    if (ip !== 'unknown') {
      const now = Date.now();
      const currentLimit = ipMap.get(ip);

      if (!currentLimit || currentLimit.resetAt < now) {
        // First request or window expired
        ipMap.set(ip, {
          count: 1,
          resetAt: now + WINDOW_MS,
        });
      } else {
        currentLimit.count++;
        if (currentLimit.count > MAX_REQUESTS) {
          return new NextResponse('Too Many Requests', { status: 429 });
        }
      }

      // Cleanup to prevent memory leaks in the isolate
      if (ipMap.size > 1000) {
        // Randomly delete entries or simple clear for rudimentary cleanup
        for (const [key, val] of ipMap.entries()) {
          if (val.resetAt < now) {
            ipMap.delete(key);
          }
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
