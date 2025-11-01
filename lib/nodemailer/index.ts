import nodemailer from 'nodemailer';
import {WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE, STOCK_ALERT_LOWER_EMAIL_TEMPLATE, STOCK_ALERT_UPPER_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";
import { canSendEmail } from '@/lib/actions/user.actions';
import { buildManageEmailPrefsUrl } from '@/lib/unsubscribe';

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    }
})

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    // Welcome emails are transactional; honor global unsubscribe if set
    const canSend = await canSendEmail(email, 'other');
    if (!canSend) return;

    const manageUrl = buildManageEmailPrefsUrl();

    let htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);
    // Inject manage prefs if template has placeholder or hash link
    htmlTemplate = htmlTemplate.replace(/href="#"(.*?)>Unsubscribe</, `href="${manageUrl}"$1>Unsubscribe<`)
                               .replace(/\{\{unsubscribeUrl\}\}/g, manageUrl);

    const mailOptions = {
        from: `"stocksVisor" <stocksvisor@gmail.com>`,
        to: email,
        subject: `Welcome to stocksVisor - your stock market toolkit is ready!`,
        text: `Thanks for joining stocksVisor\n\nManage emails: ${manageUrl}`,
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
): Promise<void> => {
    const allowed = await canSendEmail(email, 'news');
    if (!allowed) return;

    const manageUrl = buildManageEmailPrefsUrl();

    let htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent);

    // Inject manage URL into templates (supports placeholder or hash href)
    htmlTemplate = htmlTemplate.replace(/href="#"(.*?)>Unsubscribe</, `href="${manageUrl}"$1>Unsubscribe<`)
                               .replace(/\{\{unsubscribeUrl\}\}/g, manageUrl);

    const mailOptions = {
        from: `"stocksVisor News" <stocksvisor@gmail.com>`,
        to: email,
        subject: `📈 Market News Summary Today - ${date}`,
        text: `Today's market news summary from stocksVisor\n\nManage news emails: ${manageUrl}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendStockAlertEmail = async (
    {
        email,
        symbol,
        direction,
        company,
        timestamp,
        currentPrice,
        targetPrice,
    }: {
        email: string;
        symbol: string;
        direction: 'UP' | 'DOWN';
        company?: string;
        timestamp?: string | Date;
        currentPrice?: number;
        targetPrice?: number;
    }
): Promise<void> => {
    const allowed = await canSendEmail(email, 'alerts');
    if (!allowed) return;

    const template = direction === 'UP' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;

    // Prepare hydrated values with sensible fallbacks
    const safeCompany = (company && String(company).trim()) || 'N/A';
    const ts = timestamp ? new Date(timestamp) : new Date();
    const safeTimestamp = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
    const fmtNum = (n?: number) => (typeof n === 'number' && isFinite(n) ? n.toFixed(2) : 'N/A');
    const safeCurrent = fmtNum(currentPrice);
    const safeTarget = fmtNum(targetPrice);

    // Replace all supported tokens in HTML template
    let htmlTemplate = template
        .replace(/\{\{symbol\}\}/g, symbol)
        .replace(/\{\{company\}\}/g, safeCompany)
        .replace(/\{\{timestamp\}\}/g, safeTimestamp)
        .replace(/\{\{currentPrice\}\}/g, safeCurrent)
        .replace(/\{\{targetPrice\}\}/g, safeTarget);

    const manageUrl = buildManageEmailPrefsUrl();
    htmlTemplate = htmlTemplate.replace(/href="#"(.*?)>Unsubscribe</, `href="${manageUrl}"$1>Unsubscribe<`)
                               .replace(/\{\{unsubscribeUrl\}\}/g, manageUrl);

    const subject = direction === 'UP'
        ? `Price Alert: ${symbol} hit upper target`
        : `Price Alert: ${symbol} hit lower target`;

    const textBodyLines = [
        `Price alert for ${symbol}: ${direction}`,
        `Company: ${safeCompany}`,
        `Time: ${safeTimestamp}`,
        `Current Price: ${safeCurrent}`,
        `Target Price: ${safeTarget}`,
        `\nManage alerts: ${manageUrl}`,
    ];

    const mailOptions = {
        from: `"stocksVisor Alerts" <stocksvisor@gmail.com>`,
        to: email,
        subject,
        text: textBodyLines.join('\n'),
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};