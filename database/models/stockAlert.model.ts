import { Schema, model, models, type Document, type Model } from 'mongoose';

export type AlertDirection = 'UP' | 'DOWN';

export interface StockAlert extends Document {
  userId: string;
  email: string;
  symbol: string;
  direction: AlertDirection;
  thresholdPercent: number; // absolute percent threshold e.g., 5 means +5% or -5%
  active: boolean;
  createdAt: Date;
  lastNotifiedAt?: Date | null;
}

const StockAlertSchema = new Schema<StockAlert>(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    direction: { type: String, required: true, enum: ['UP', 'DOWN'] },
    thresholdPercent: { type: Number, required: true, min: 0.1, max: 100 },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

// Prevent duplicate active alerts for the same config per user
StockAlertSchema.index(
  { userId: 1, symbol: 1, direction: 1, thresholdPercent: 1 },
  { unique: true }
);

export const StockAlertModel: Model<StockAlert> =
  (models?.StockAlert as Model<StockAlert>) || model<StockAlert>('StockAlert', StockAlertSchema);
