import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    // Keep original lightweight MIME pre-check, but we will validate content below
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Unsupported file type' }, { status: 400 });
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, message: 'File too large (max 2MB)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Server-side content validation using sharp (if available) or magic bytes
    const isAllowedFormat = (fmt: string | null | undefined) => ['png', 'jpeg', 'webp'].includes(String(fmt).toLowerCase());

    // Magic bytes fallback detection for PNG/JPEG/WEBP
    const detectByMagicBytes = (buf: Buffer): 'png' | 'jpeg' | 'webp' | null => {
      if (buf.length >= 12) {
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        const isPng = pngSig.every((v, i) => buf[i] === v);
        if (isPng) return 'png';

        // JPEG: FF D8 ... (start)
        if (buf[0] === 0xFF && buf[1] === 0xD8) return 'jpeg';

        // WEBP: RIFF____WEBP
        const riff = buf.toString('ascii', 0, 4) === 'RIFF';
        const webp = buf.toString('ascii', 8, 12) === 'WEBP';
        if (riff && webp) return 'webp';
      }
      return null;
    };

    let detectedFormat: 'png' | 'jpeg' | 'webp' | null = null;

    // Try sharp metadata first
    try {
      const sharpMod = await import('sharp').catch(() => null as any);
      if (sharpMod) {
        const sharp = (sharpMod as any).default || sharpMod;
        const meta = await sharp(buffer).metadata();
        const fmt = (meta?.format || '').toLowerCase();
        if (isAllowedFormat(fmt)) {
          detectedFormat = fmt as 'png' | 'jpeg' | 'webp';
          // Optional normalization: resize to max 512px dimension, keep aspect ratio
          try {
            buffer = await sharp(buffer)
              .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
              .toFormat(detectedFormat)
              .toBuffer();
          } catch {
            // If processing fails, keep original buffer; we'll still save after validation
          }
        }
      }
    } catch {
      // ignore: will use magic bytes fallback
    }

    if (!detectedFormat) {
      detectedFormat = detectByMagicBytes(buffer);
    }

    if (!detectedFormat) {
      return NextResponse.json({ success: false, message: 'Unsupported or invalid image file' }, { status: 400 });
    }

    const ext = detectedFormat;
    const fileName = `${session.user.id}-${Date.now()}.${ext}`;

    const publicDir = path.join(process.cwd(), 'public');
    const avatarsDir = path.join(publicDir, 'avatars');

    let urlPath: string | null = null;

    try {
      await fs.mkdir(avatarsDir, { recursive: true });

      // Cleanup: remove any previously uploaded avatars for this user so we don't keep old files
      try {
        const existing = await fs.readdir(avatarsDir);
        const toDelete = existing.filter(
          (n) => n.startsWith(`${session.user.id}-`) || n.startsWith(`${session.user.id}.`)
        );
        await Promise.all(
          toDelete.map((n) => fs.unlink(path.join(avatarsDir, n)).catch(() => {}))
        );
      } catch {
        // ignore cleanup errors
      }

      // Attempt to persist on disk (works on environments with writable FS)
      const filePath = path.join(avatarsDir, fileName);
      await fs.writeFile(filePath, buffer);
      urlPath = `/avatars/${fileName}`;
    } catch (writeErr) {
      // Production fallback: some platforms (e.g., serverless) have read-only FS.
      // Return a base64 data URL so the client can still save and display the avatar.
      try {
        const mime = detectedFormat === 'png' ? 'image/png' : detectedFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
        const base64 = buffer.toString('base64');
        urlPath = `data:${mime};base64,${base64}`;
        console.warn('Avatar persisted as data URL due to FS write restrictions');
      } catch (fallbackErr) {
        console.error('avatar upload failed (fallback error)', fallbackErr);
        return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, url: urlPath });
  } catch (e) {
    console.error('avatar upload failed', e);
    return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 });
  }
}
