'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateUserProfile, deleteUserAccount } from '@/lib/actions/user.actions';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ProfileInitial = { name: string; email: string; image: string | null; dailyNews?: boolean };

export default function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const [name, setName] = useState<string>(initial.name || '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.image || null);
  const [dailyNews, setDailyNews] = useState<boolean>(initial.dailyNews !== false);
  const [saving, setSaving] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return setFile(null);
    setFile(f);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let imageUrl: string | undefined = undefined;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload/avatar', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.message || 'Upload failed');
        imageUrl = data.url as string;
      }

      const result = await updateUserProfile({ name, imageUrl, dailyNews });
      if (!result?.success) throw new Error(result?.message || 'Failed to save');

      router.refresh();
    } catch (err) {
      console.error('Save failed', err);
      alert((err as Error)?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatar = preview || '/assets/images/logo.png';

  return (
    <form onSubmit={onSubmit} className="max-w-xl w-full space-y-6">
      <div className="space-y-2">
        <label className="block text-sm text-gray-400">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-400">Profile Picture</label>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentAvatar} alt="Avatar preview" className="h-16 w-16 rounded-full object-cover border border-gray-700" />
          <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} />
        </div>
        <p className="text-xs text-gray-500">PNG, JPG, or WEBP. Max 2MB.</p>
      </div>

      <div className="space-y-2">
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={dailyNews}
            onChange={(e) => setDailyNews(e.target.checked)}
          />
          Receive daily market news emails
        </label>
        <p className="text-xs text-gray-500">You can unsubscribe anytime from email footers.</p>
      </div>

      <div className="flex gap-3 items-center justify-between">
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
        <Button type="button" variant="destructive" className="text-white" onClick={() => setConfirmOpen(true)}>
          Delete account
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This will permanently delete your profile and associated data (watchlist and price alerts). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              No, keep my account
            </Button>
            <Button type="button" variant="destructive" className="text-white" disabled={deleting} onClick={async () => {
              try {
                setDeleting(true);
                const res = await deleteUserAccount();
                if (!res?.success) throw new Error(res?.message || 'Failed to delete account');
                // After deletion, sign out by navigating to sign-in
                router.push('/sign-in');
              } catch (e) {
                console.error(e);
                alert((e as any)?.message || 'Failed to delete account');
              } finally {
                setDeleting(false);
                setConfirmOpen(false);
              }
            }}>
              {deleting ? 'Deleting...' : 'Yes, delete my account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
