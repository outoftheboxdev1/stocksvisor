import crypto from 'crypto';

const getBaseUrl = () => {
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (publicUrl) {
    if (publicUrl.startsWith('http')) return publicUrl;
    return `https://${publicUrl}`;
  }
  return 'http://localhost:3000';
};

const getSecret = () => {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NODEMAILER_PASSWORD || 'dev-secret';
  return secret;
};

export function signUnsubscribeToken(email: string, scope: 'all' | 'news' = 'all'): string {
  const ts = Date.now();
  const payload = `${email}.${scope}.${ts}`;
  const hmac = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  const token = Buffer.from(`${email}.${scope}.${ts}.${hmac}`, 'utf8').toString('base64url');
  return token;
}

export function verifyUnsubscribeToken(token: string): { valid: boolean; email?: string; scope?: 'all' | 'news' } {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [email, scope, tsStr, sig] = raw.split('.');
    if (!email || !scope || !tsStr || !sig) return { valid: false };
    const payload = `${email}.${scope}.${Number(tsStr)}`;
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (expected !== sig) return { valid: false };
    // Optional: expire after 30 days
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - Number(tsStr) > maxAgeMs) return { valid: false };
    return { valid: true, email, scope: scope === 'news' ? 'news' : 'all' };
  } catch {
    return { valid: false };
  }
}

export function buildUnsubscribeUrl(email: string, scope: 'all' | 'news' = 'all'): string {
  const token = signUnsubscribeToken(email, scope);
  const base = getBaseUrl();
  return `${base}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function buildManageEmailPrefsUrl(): string {
  const base = getBaseUrl();
  return `${base}/settings/profile`;
}
