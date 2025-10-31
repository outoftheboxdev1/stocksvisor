import { NextRequest, NextResponse } from "next/server";

// Simplified middleware: let requests pass through.
// Page-level guards (server actions/pages) will handle auth redirects.
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sign-in|sign-up|assets).*)',
  ],
};
