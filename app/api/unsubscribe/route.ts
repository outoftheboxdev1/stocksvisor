import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Redirect legacy unsubscribe links to the Profile Settings page where users can manage email preferences.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // Preserve optional scope parameter from older links for possible future use
    const scope = url.searchParams.get('scope') || undefined;
    const target = new URL('/settings/profile', url.origin);
    if (scope) target.searchParams.set('from', 'unsubscribe');
    return NextResponse.redirect(target, 302);
  } catch (e) {
    // Fallback: go to home if something goes wrong
    return NextResponse.redirect(new URL('/', (request as any).url ?? 'http://localhost:3000'), 302);
  }
}
