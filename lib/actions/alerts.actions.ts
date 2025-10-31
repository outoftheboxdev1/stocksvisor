'use server';

import { connectToDatabase } from '@/database/mongoose';
import { StockAlertModel, type StockAlert } from '@/database/models/stockAlert.model';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type CreateAlertInput = {
  symbol: string;
  direction: 'UP' | 'DOWN';
  thresholdPercent: number; // e.g., 5 means +5% or -5%
};

const getSessionOrRedirect = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');
  return session;
};

export const createStockAlert = async (
  { symbol, direction, thresholdPercent }: CreateAlertInput
): Promise<{ success: boolean; message?: string }> => {
  try {
    const session = await getSessionOrRedirect();

    const cleanSymbol = symbol.trim().toUpperCase();
    const pct = Number(thresholdPercent);
    if (!cleanSymbol) return { success: false, message: 'Symbol is required' };
    if (!['UP', 'DOWN'].includes(direction)) return { success: false, message: 'Invalid direction' };
    if (Number.isNaN(pct) || pct < 0.1 || pct > 100)
      return { success: false, message: 'Threshold must be between 0.1 and 100' };

    await connectToDatabase();

    await StockAlertModel.updateOne(
      {
        userId: session.user.id,
        email: session.user.email,
        symbol: cleanSymbol,
        direction,
        thresholdPercent: pct,
      },
      {
        $setOnInsert: {
          userId: session.user.id,
          email: session.user.email,
          symbol: cleanSymbol,
          direction,
          thresholdPercent: pct,
          active: true,
          createdAt: new Date(),
          lastNotifiedAt: null,
        } as Partial<StockAlert>,
        $set: { active: true },
      },
      { upsert: true }
    );

    revalidatePath('/watchlist');
    return { success: true, message: 'Alert created' };
  } catch (error: any) {
    if (error?.code === 11000) {
      return { success: true, message: 'Alert already exists and is active' };
    }
    console.error('createStockAlert error:', error);
    return { success: false, message: error?.message || 'Failed to create alert' };
  }
};

export const getStockAlertForSymbol = async (
  symbol: string
): Promise<{ success: boolean; alert?: { direction: 'UP' | 'DOWN'; thresholdPercent: number } | null; message?: string }> => {
  try {
    const session = await getSessionOrRedirect();
    await connectToDatabase();
    const cleanSymbol = symbol.trim().toUpperCase();
    const doc = await StockAlertModel.findOne({ userId: session.user.id, symbol: cleanSymbol, active: true }).lean();
    if (!doc) return { success: true, alert: null };
    return { success: true, alert: { direction: doc.direction as 'UP' | 'DOWN', thresholdPercent: doc.thresholdPercent } };
  } catch (e: any) {
    console.error('getStockAlertForSymbol error:', e);
    return { success: false, message: e?.message || 'Failed to load alert' };
  }
};

export const updateStockAlert = async (
  { symbol, direction, thresholdPercent }: CreateAlertInput
): Promise<{ success: boolean; message?: string }> => {
  try {
    const session = await getSessionOrRedirect();
    const cleanSymbol = symbol.trim().toUpperCase();
    const pct = Number(thresholdPercent);
    if (!cleanSymbol) return { success: false, message: 'Symbol is required' };
    if (!['UP', 'DOWN'].includes(direction)) return { success: false, message: 'Invalid direction' };
    if (Number.isNaN(pct) || pct < 0.1 || pct > 100)
      return { success: false, message: 'Threshold must be between 0.1 and 100' };

    await connectToDatabase();

    // Replace any existing alerts for this symbol with the new one to keep a single active alert per symbol
    await StockAlertModel.deleteMany({ userId: session.user.id, symbol: cleanSymbol });
    await StockAlertModel.create({
      userId: session.user.id,
      email: session.user.email,
      symbol: cleanSymbol,
      direction,
      thresholdPercent: pct,
      active: true,
      createdAt: new Date(),
      lastNotifiedAt: null,
    } as Partial<StockAlert>);

    revalidatePath('/watchlist');
    return { success: true, message: 'Alert saved' };
  } catch (e: any) {
    console.error('updateStockAlert error:', e);
    return { success: false, message: e?.message || 'Failed to save alert' };
  }
};

export const deleteStockAlertForSymbol = async (
  symbol: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const session = await getSessionOrRedirect();
    const cleanSymbol = symbol.trim().toUpperCase();
    await connectToDatabase();
    await StockAlertModel.deleteMany({ userId: session.user.id, symbol: cleanSymbol });
    revalidatePath('/watchlist');
    return { success: true, message: 'Alert deleted' };
  } catch (e: any) {
    console.error('deleteStockAlertForSymbol error:', e);
    return { success: false, message: e?.message || 'Failed to delete alert' };
  }
};
