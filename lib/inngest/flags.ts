function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;

    switch (value.trim().toLowerCase()) {
        case '1':
        case 'true':
        case 'yes':
        case 'on':
            return true;
        case '0':
        case 'false':
        case 'no':
        case 'off':
            return false;
        default:
            return defaultValue;
    }
}

// Emergency kill switches for background jobs that can drive usage.
// Defaults are intentionally off until each job is explicitly re-enabled.
export const ENABLE_SIGNUP_EMAILS = parseBooleanEnv(
    process.env.ENABLE_SIGNUP_EMAILS,
    false
);

export const ENABLE_DAILY_NEWS_SUMMARY = parseBooleanEnv(
    process.env.ENABLE_DAILY_NEWS_SUMMARY,
    false
);

export const ENABLE_STOCK_ALERTS = parseBooleanEnv(
    process.env.ENABLE_STOCK_ALERTS,
    false
);
