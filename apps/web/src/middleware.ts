import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Passes the current pathname through as a request header so server
 * components (the Business/Group layouts' payment gate) can tell which
 * route is being rendered without a client-side usePathname() — needed to
 * let the Billing page itself through while every other page is gated.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/business/:path*", "/group/:path*"],
};
