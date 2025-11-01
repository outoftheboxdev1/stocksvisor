import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Redirect legacy unsubscribe links to the Profile Settings page where users can manage email preferences.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;
    // Preserve optional scope parameter from older links for possible future use
    const scope = url.searchParams.get('scope') || undefined;
    const target = new URL('/settings/profile', origin);
    if (scope) target.searchParams.set('from', 'unsubscribe');
    return NextResponse.redirect(target, 302);
  } catch (e) {
    // Robust fallback: prefer configured base URL; otherwise use site root
    const rawBase = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || '/';
    if (rawBase === '/') {
      return NextResponse.redirect('/', 302);
    }
    const base = rawBase.startsWith('http') ? rawBase : `https://${rawBase}`;
    try {
      return NextResponse.redirect(`${base}/settings/profile`, 302);
    } catch {
      return NextResponse.redirect('/', 302);
    }
  }
}
