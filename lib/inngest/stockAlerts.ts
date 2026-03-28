import { inngest } from '@/lib/inngest/client';
import { StockAlertModel } from '@/database/models/stockAlert.model';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';
import { sendStockAlertEmail } from '@/lib/nodemailer';
import { connectToDatabase } from '@/database/mongoose';

type TriggeredAlertPayload = {
  alertId: string;
  email: string;
  symbol: string;
  direction: 'UP' | 'DOWN';
  company?: string;
  currentPrice?: number;
  targetPrice?: number;
};

export const checkStockAlerts = inngest.createFunction(
  { id: 'check-stock-alerts' },
  [ { event: 'app/check.stock.alerts' }, { cron: '*/10 * * * *' } ],
  async ({ step }) => {
    const triggeredAlerts = await step.run('evaluate-active-alerts', async () => {
      await connectToDatabase();

      const alerts = await StockAlertModel.find({ active: true }).lean();
      if (!alerts || alerts.length === 0) {
        return [] as TriggeredAlertPayload[];
      }

      const bySymbol = new Map<string, typeof alerts>();
      for (const alert of alerts) {
        const symbol = alert.symbol.toUpperCase();
        const existing = bySymbol.get(symbol) || [];
        existing.push(alert);
        bySymbol.set(symbol, existing);
      }

      const triggered: TriggeredAlertPayload[] = [];

      for (const [symbol, list] of bySymbol.entries()) {
        try {
          const data = await getStocksDetails(symbol);
          const change = data?.changePercent ?? 0;

          for (const alert of list) {
            const shouldTrigger = alert.direction === 'UP'
              ? change >= alert.thresholdPercent
              : change <= -alert.thresholdPercent;

            if (!shouldTrigger) {
              continue;
            }

            const currentPrice = data?.currentPrice;
            const changePercent = data?.changePercent ?? 0;
            const prevClose = (typeof currentPrice === 'number' && isFinite(currentPrice))
              ? currentPrice / (1 + (changePercent / 100))
              : undefined;
            const threshold = alert.thresholdPercent;
            const targetPrice = prevClose !== undefined
              ? (alert.direction === 'UP'
                  ? prevClose * (1 + threshold / 100)
                  : prevClose * (1 - threshold / 100))
              : undefined;

            triggered.push({
              alertId: String(alert._id),
              email: alert.email,
              symbol,
              direction: alert.direction,
              company: data?.company,
              currentPrice,
              targetPrice,
            });
          }
        } catch (e) {
          console.error('checkStockAlerts: error for symbol', symbol, e);
        }
      }

      return triggered;
    });

    if (triggeredAlerts.length === 0) {
      return { success: true, message: 'No alerts triggered' };
    }

    const notifiedCount = await step.run('notify-triggered-alerts', async () => {
      await connectToDatabase();

      let sent = 0;

      for (const alert of triggeredAlerts) {
        const activeAlert = await StockAlertModel.findOne({ _id: alert.alertId, active: true }).lean();
        if (!activeAlert) {
          continue;
        }

        await sendStockAlertEmail({
          email: alert.email,
          symbol: alert.symbol,
          direction: alert.direction,
          company: alert.company,
          timestamp: new Date(),
          currentPrice: alert.currentPrice,
          targetPrice: alert.targetPrice,
        });

        await StockAlertModel.updateOne(
          { _id: alert.alertId },
          { $set: { active: false, lastNotifiedAt: new Date() } }
        );
        sent += 1;
      }

      return sent;
    });

    return {
      success: true,
      triggered: triggeredAlerts.length,
      notified: notifiedCount,
    };
  }
);
