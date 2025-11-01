'use server';

import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

        // Try match by id first, then fall back to email in case IDs differ.
        const user = await db.collection('user').findOne(
            { $or: [ { id: session.user.id }, { email: session.user.email } ] },
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
    await db.collection('user').updateOne(
      { $or: [ { id: session.user.id }, { email: session.user.email } ] },
      { $set: update },
      { upsert: true }
    );

    // Revalidate places where the avatar/name show up (e.g., layout, dropdown)
    revalidatePath('/');
    revalidatePath('/watchlist');

    return { success: true } as const;
}

// Helper to check if we can send a given email category to this address
export const canSendEmail = async (email: string, category?: 'news' | 'alerts' | 'other') => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('DB not connected');
        const user = await db.collection('user').findOne({ email: email.toLowerCase() }, { projection: { emailUnsubscribed: 1, emailPrefs: 1 } });
        const unsub = !!(user as any)?.emailUnsubscribed;
        if (unsub) return false;
        if (category === 'news') {
            const dailyNewsPref = (user as any)?.emailPrefs?.dailyNews;
            if (dailyNewsPref === false) return false;
        }
        return true;
    } catch (e) {
        // On errors, be conservative and allow sends to avoid silent drops when DB is unavailable
        return true;
    }
}