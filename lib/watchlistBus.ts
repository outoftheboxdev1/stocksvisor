'use client';

export type WatchlistUpdate = { symbol: string; isAdded: boolean };

const CHANNEL = 'watchlist:updates';

// BroadcastChannel when available (also syncs across tabs)
const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHANNEL)
    : null;

// fire an update
export function emitWatchlistUpdate(payload: WatchlistUpdate) {
    if (bc) bc.postMessage(payload);
    // DOM event fallback (same tab)
    window.dispatchEvent(new CustomEvent(CHANNEL, { detail: payload }));
}

// subscribe to updates; returns an unsubscribe fn
export function onWatchlistUpdate(cb: (p: WatchlistUpdate) => void) {
    const bcHandler = (ev: MessageEvent<WatchlistUpdate>) => cb(ev.data);
    const domHandler = (ev: Event) => cb((ev as CustomEvent<WatchlistUpdate>).detail);

    if (bc) bc.addEventListener('message', bcHandler);
    window.addEventListener(CHANNEL, domHandler);

    return () => {
        if (bc) bc.removeEventListener('message', bcHandler);
        window.removeEventListener(CHANNEL, domHandler);
    };
}
