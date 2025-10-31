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

        const users = await db.collection('user').find(
            { email: { $exists: true, $ne: null }},
            { projection: { _id: 1, id: 1, email: 1, name: 1, country:1 }}
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
            { projection: { _id: 0, id: 1, email: 1, name: 1, image: 1 } }
        );

        if (user) {
            return {
                id: user.id || session.user.id,
                email: user.email || session.user.email,
                name: (user.name as string) || '',
                image: (user.image as string) || null,
            } as { id: string; email: string; name: string; image: string | null };
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
    } as { id: string; email: string; name: string; image: string | null };
}

export const updateUserProfile = async (params: { name?: string; imageUrl?: string }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    const name = typeof params?.name === 'string' ? params.name.trim() : undefined;
    const imageUrl = typeof params?.imageUrl === 'string' ? params.imageUrl.trim() : undefined;

    if (!name && !imageUrl) return { success: false, message: 'Nothing to update' } as const;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Mongoose connection not connected');

    const update: Record<string, any> = {};
    if (typeof name === 'string' && name.length > 0) update.name = name;
    if (typeof imageUrl === 'string' && imageUrl.length > 0) update.image = imageUrl;

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