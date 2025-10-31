import nodemailer from 'nodemailer';
import {WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE, STOCK_ALERT_LOWER_EMAIL_TEMPLATE, STOCK_ALERT_UPPER_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    }
})

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: `"stocksVisor" <stocksvisor@gmail.com>`,
        to: email,
        subject: `Welcome to stocksVisor - your stock market toolkit is ready!`,
        text: 'Thanks for joining stocksVisor',
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
): Promise<void> => {
    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent);

    const mailOptions = {
        from: `"stocksVisor News" <stocksvisor@gmail.com>`,
        to: email,
        subject: `📈 Market News Summary Today - ${date}`,
        text: `Today's market news summary from stocksVisor`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendStockAlertEmail = async (
    { email, symbol, direction }: { email: string; symbol: string; direction: 'UP'|'DOWN' }
): Promise<void> => {
    const template = direction === 'UP' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;
    const htmlTemplate = template.replace(/\{\{symbol\}\}/g, symbol);

    const subject = direction === 'UP'
        ? `Price Alert: ${symbol} hit upper target`
        : `Price Alert: ${symbol} hit lower target`;

    const mailOptions = {
        from: `"stocksVisor Alerts" <stocksvisor@gmail.com>`,
        to: email,
        subject,
        text: `Price alert for ${symbol}: ${direction}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};