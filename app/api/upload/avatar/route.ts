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
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Unsupported file type' }, { status: 400 });
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, message: 'File too large (max 2MB)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${session.user.id}-${Date.now()}.${ext}`;

    const publicDir = path.join(process.cwd(), 'public');
    const avatarsDir = path.join(publicDir, 'avatars');

    try {
      await fs.mkdir(avatarsDir, { recursive: true });
    } catch (e) {
      // ignore if exists
    }

    const filePath = path.join(avatarsDir, fileName);
    await fs.writeFile(filePath, buffer);

    const urlPath = `/avatars/${fileName}`;

    return NextResponse.json({ success: true, url: urlPath });
  } catch (e) {
    console.error('avatar upload failed', e);
    return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 });
  }
}
