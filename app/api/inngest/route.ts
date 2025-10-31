import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import {sendDailyNewsSummary, sendSignUpEmail} from "@/lib/inngest/functions";
import { checkStockAlerts } from "@/lib/inngest/stockAlerts";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendDailyNewsSummary, checkStockAlerts],
})