'use server';

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Watchlist } from "@/database/models/watchlist.model";
import { StockAlertModel } from "@/database/models/stockAlert.model";
import path from "path";
import { promises as fs } from "fs";

export const getAllUsersForNewsEmail = async () => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Mongoose connection not connected');

        // Only include users who have not globally unsubscribed and have dailyNews enabled (default true)
        const users = await db.collection('user').find(
            {
                email: { $exists: true, $ne: null },
                $and: [
                  { $or: [ { emailUnsubscribed: { $exists: false } }, { emailUnsubscribed: { $ne: true } } ] },
                  { $or: [ { 'emailPrefs.dailyNews': { $exists: false } }, { 'emailPrefs.dailyNews': { $ne: false } } ] }
                ]
            },
            { projection: { _id: 1, id: 1, email: 1, name: 1, country:1 } }
        ).toArray();

        return users.filter((user) => user.email && user.name).map((user) => ({
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name
        }))
    } catch (e) {
        console.error('Error fetching users for news email:', e)
        return []
    }
}

export const getCurrentUserProfile = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    // Attempt to load the user record from the DB, but don't force-redirect
    // if it's missing. We'll gracefully fall back to the session values.
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('Mongoose connection not connected');

        // Try match by id first, then fall back to normalized email
        const emailLower = typeof session.user.email === 'string' ? session.user.email.trim().toLowerCase() : undefined;
        const user = await db.collection('user').findOne(
            { $or: [ { id: session.user.id }, ...(emailLower ? [{ email: emailLower }] as any[] : []) ] },
            { projection: { _id: 0, id: 1, email: 1, name: 1, image: 1, emailUnsubscribed: 1, emailPrefs: 1 } }
        );

        if (user) {
            return {
                id: user.id || session.user.id,
                email: user.email || session.user.email,
                name: (user.name as string) || '',
                image: (user.image as string) || null,
                emailUnsubscribed: !!(user as any).emailUnsubscribed,
                emailPrefs: { dailyNews: (user as any)?.emailPrefs?.dailyNews !== false }
            } as any;
        }
    } catch (err) {
        // Log and fall back to session values
        console.error('getCurrentUserProfile: DB lookup failed, falling back to session', err);
    }

    // Fallback: return values from the authenticated session without redirect
    return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || '',
        image: (session.user as any).image || null,
        emailUnsubscribed: false,
        emailPrefs: { dailyNews: true }
    } as any;
}

export const updateUserProfile = async (params: { name?: string; imageUrl?: string; dailyNews?: boolean; unsubscribeAll?: boolean }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    const name = typeof params?.name === 'string' ? params.name.trim() : undefined;
    const imageUrl = typeof params?.imageUrl === 'string' ? params.imageUrl.trim() : undefined;
    const dailyNews = typeof params?.dailyNews === 'boolean' ? params.dailyNews : undefined;
    const unsubscribeAll = params?.unsubscribeAll === true;

    if (!name && !imageUrl && typeof dailyNews === 'undefined' && !unsubscribeAll) return { success: false, message: 'Nothing to update' } as const;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Mongoose connection not connected');

    const update: Record<string, any> = {};
    if (typeof name === 'string' && name.length > 0) update.name = name;
    if (typeof imageUrl === 'string' && imageUrl.length > 0) update.image = imageUrl;
    if (typeof dailyNews !== 'undefined') update['emailPrefs.dailyNews'] = dailyNews;
    if (unsubscribeAll) update['emailUnsubscribed'] = true;

    // Update by id OR email to handle cases where user doc may not have id populated.
    const normalizedEmail = typeof session.user.email === 'string' ? session.user.email.trim().toLowerCase() : undefined;
    await db.collection('user').updateOne(
      { $or: [ { id: session.user.id }, ...(normalizedEmail ? [{ email: normalizedEmail }] as any[] : []) ] },
      { $set: update },
      { upsert: true }
    );

    // Revalidate places where the avatar/name show up (e.g., layout, dropdown)
    revalidatePath('/');
    revalidatePath('/watchlist');

    return { success: true } as const;
}

export const deleteUserAccount = async (): Promise<{ success: boolean; message?: string }> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('Mongoose connection not connected');

        const userId = session.user.id;
        const normalizedEmail = typeof session.user.email === 'string' ? session.user.email.trim().toLowerCase() : undefined;

        let usedTransaction = false;
        const ms = await mongoose.startSession();
        try {
            await ms.withTransaction(async () => {
                // Delete related docs and the user atomically within a transaction
                await Watchlist.deleteMany({ userId }).session(ms);
                await StockAlertModel.deleteMany({ userId }).session(ms);
                await db.collection('user').deleteOne({
                    $or: [ { id: userId }, ...(normalizedEmail ? [{ email: normalizedEmail }] as any[] : []) ]
                }, { session: ms });
            }, { writeConcern: { w: 'majority' } as any });
            usedTransaction = true;
        } catch (txErr: any) {
            // If transactions are not supported (standalone server), fall back to non-transactional deletes
            const msg: string = txErr?.message || '';
            const isNoTxnSupport = txErr?.code === 20 || /replica set|transaction numbers are only allowed/i.test(msg);
            if (!isNoTxnSupport) {
                throw txErr;
            }
            // Fallback (best-effort) without session
            await Promise.all([
                Watchlist.deleteMany({ userId }),
                StockAlertModel.deleteMany({ userId }),
            ]);
            await db.collection('user').deleteOne({
                $or: [ { id: userId }, ...(normalizedEmail ? [{ email: normalizedEmail }] as any[] : []) ]
            });
        } finally {
            // Ensure the session is always ended
            try { await ms.endSession(); } catch {}
        }

        // Best-effort: Remove user's avatar file(s) from public/avatars
        try {
            const publicDir = path.join(process.cwd(), 'public');
            const avatarsDir = path.join(publicDir, 'avatars');
            const entries = await fs.readdir(avatarsDir).catch(() => [] as string[]);
            if (Array.isArray(entries) && entries.length) {
                const toDelete = entries.filter((n) =>
                    typeof n === 'string' && (n.startsWith(`${userId}-`) || n.startsWith(`${userId}.`))
                );
                await Promise.all(
                    toDelete.map((name) => fs.unlink(path.join(avatarsDir, name)).catch(() => {}))
                );
            }
        } catch (fsErr) {
            // Ignore file system errors; account deletion should not fail due to avatar cleanup
            console.warn('Avatar cleanup failed', fsErr);
        }

        // Invalidate Better Auth session to revoke cookies before UI revalidation
        await auth.api.signOut({ headers: await headers() });

        // Revalidate UI where user data might appear
        revalidatePath('/');
        revalidatePath('/watchlist');

        return { success: true };
    } catch (e: any) {
        console.error('deleteUserAccount error:', e);
        return { success: false, message: e?.message || 'Failed to delete account' };
    }
}

// Helper to check if we can send a given email category to this address
// Simple in-memory cache and circuit-breaker for email preferences
const __emailPrefsCache: Map<string, { unsub: boolean; dailyNews: boolean; ts: number }> = new Map();
const PREFS_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Naive circuit-breaker: open on repeated failures to avoid hammering DB
let __cbFailureCount = 0;
let __cbOpenedAt: number | null = null;
const CB_FAILURE_THRESHOLD = 5; // 5 consecutive failures
const CB_OPEN_MS = 60 * 1000; // stay open for 60s

function isCacheFresh(entry?: { ts: number }): boolean {
    if (!entry) return false;
    return Date.now() - entry.ts < PREFS_TTL_MS;
}

function isCircuitOpen(): boolean {
    if (__cbOpenedAt == null) return false;
    if (Date.now() - __cbOpenedAt < CB_OPEN_MS) return true;
    // reset after open window passes
    __cbOpenedAt = null;
    __cbFailureCount = 0;
    return false;
}

function recordFailure() {
    __cbFailureCount += 1;
    if (__cbFailureCount >= CB_FAILURE_THRESHOLD) {
        __cbOpenedAt = Date.now();
    }
}

function recordSuccess() {
    __cbFailureCount = 0;
    __cbOpenedAt = null;
}

export const canSendEmail = async (email: string, category?: 'news' | 'alerts' | 'other') => {
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalized) return false;

    // If breaker is open, try cache; otherwise fail-closed
    if (isCircuitOpen()) {
        const cached = __emailPrefsCache.get(normalized);
        if (isCacheFresh(cached)) {
            const { unsub, dailyNews } = cached!;
            if (unsub) return false;
            if (category === 'news' && dailyNews === false) return false;
            return true;
        }
        return false; // fail-closed when no fresh cache
    }

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('DB not connected');

        const user = await db.collection('user').findOne(
            { email: normalized },
            { projection: { emailUnsubscribed: 1, emailPrefs: 1 } }
        );

        const unsub = !!(user as any)?.emailUnsubscribed;
        const dailyNewsPref = (user as any)?.emailPrefs?.dailyNews;
        const dailyNews = dailyNewsPref !== false; // default true

        // cache result
        __emailPrefsCache.set(normalized, { unsub, dailyNews, ts: Date.now() });

        recordSuccess();

        if (unsub) return false;
        if (category === 'news' && dailyNews === false) return false;
        return true;
    } catch (e: any) {
        recordFailure();

        // Structured logging with context
        console.error('canSendEmail error', {
            message: e?.message || 'unknown error',
            stack: e?.stack,
            context: {
                email: normalized,
                category: category || 'unspecified',
                action: 'canSendEmail'
            }
        });

        // Try stale cache before failing closed
        const cached = __emailPrefsCache.get(normalized);
        if (isCacheFresh(cached)) {
            const { unsub, dailyNews } = cached!;
            if (unsub) return false;
            if (category === 'news' && dailyNews === false) return false;
            return true;
        }

        // Fail-closed on exceptions (no fresh cache)
        return false;
    }
}