import { inngest } from '@/lib/inngest/client';
import { StockAlertModel } from '@/database/models/stockAlert.model';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';
import { sendStockAlertEmail } from '@/lib/nodemailer';
import { connectToDatabase } from '@/database/mongoose';

export const checkStockAlerts = inngest.createFunction(
  { id: 'check-stock-alerts' },
  [ { event: 'app/check.stock.alerts' }, { cron: '*/10 * * * *' } ],
  async ({ step }) => {
    await step.run('connect-db', connectToDatabase);

    // Step 1: Load active alerts
    const alerts = await step.run('load-active-alerts', async () => {
      return await StockAlertModel.find({ active: true }).lean();
    });

    if (!alerts || alerts.length === 0) {
      return { success: true, message: 'No active alerts' };
    }

    // Step 2: Group by symbol
    const bySymbol = new Map<string, typeof alerts>();
    for (const a of alerts) {
      const key = a.symbol.toUpperCase();
      const list = bySymbol.get(key) || [];
      list.push(a);
      bySymbol.set(key, list);
    }

    // Step 3: For each symbol, fetch current data once
    for (const [symbol, list] of bySymbol.entries()) {
      try {
        const data = await step.run(`fetch-${symbol}`, async () => getStocksDetails(symbol));
        const change = data?.changePercent ?? 0; // positive up, negative down

        for (const alert of list) {
          const trigger = alert.direction === 'UP'
            ? change >= alert.thresholdPercent
            : change <= -alert.thresholdPercent;

          if (trigger) {
            // Send email and deactivate alert
            await step.run(`email-${symbol}-${alert._id}`, async () => {
              // Estimate previous close from current change percent to compute target price
              const currentPrice = data?.currentPrice;
              const changePercent = data?.changePercent ?? 0;
              const prevClose = (typeof currentPrice === 'number' && isFinite(currentPrice))
                ? currentPrice / (1 + (changePercent / 100))
                : undefined;
              const threshold = alert.thresholdPercent;
              const targetPrice = (prevClose !== undefined)
                ? (alert.direction === 'UP'
                    ? prevClose * (1 + threshold / 100)
                    : prevClose * (1 - threshold / 100))
                : undefined;

              await sendStockAlertEmail({
                email: alert.email,
                symbol,
                direction: alert.direction,
                company: data?.company,
                timestamp: new Date(),
                currentPrice,
                targetPrice,
              });
            });

            await step.run(`deactivate-${alert._id}`, async () => {
              await StockAlertModel.updateOne({ _id: alert._id }, { $set: { active: false, lastNotifiedAt: new Date() } });
            });
          }
        }
      } catch (e) {
        console.error('checkStockAlerts: error for symbol', symbol, e);
      }
    }

    return { success: true };
  }
);
