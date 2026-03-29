import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import {sendDailyNewsSummary, sendSignUpEmail} from "@/lib/inngest/functions";
import { checkStockAlerts } from "@/lib/inngest/stockAlerts";
import {
    ENABLE_DAILY_NEWS_SUMMARY,
    ENABLE_SIGNUP_EMAILS,
    ENABLE_STOCK_ALERTS,
} from "@/lib/inngest/flags";

const functions = [
    ENABLE_SIGNUP_EMAILS ? sendSignUpEmail : null,
    ENABLE_DAILY_NEWS_SUMMARY ? sendDailyNewsSummary : null,
    ENABLE_STOCK_ALERTS ? checkStockAlerts : null,
].filter((fn): fn is typeof sendSignUpEmail | typeof sendDailyNewsSummary | typeof checkStockAlerts => Boolean(fn));

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions,
})
