'use client';
import { useDebounce } from '@/hooks/useDebounce';
import {
    addToWatchlist,
    removeFromWatchlist,
} from '@/lib/actions/watchlist.actions';
import { Star, StarIcon, Stars, Trash2 } from 'lucide-react';
import React, {useEffect, useMemo, useState} from 'react';
import { toast } from 'sonner';
import { emitWatchlistUpdate } from '@/lib/watchlistBus';

// Minimal WatchlistButton implementation to satisfy page requirements.
// This component focuses on UI contract only. It toggles local state and
// calls onWatchlistChange if provided. Styling hooks match globals.css.

export const WatchlistButton = ({
                             symbol,
                             company,
                             isInWatchlist,
                             showTrashIcon = false,
                             type = 'button',
                             onWatchlistChange,
                         }: WatchlistButtonProps) => {
    const [added, setAdded] = useState<boolean>(!!isInWatchlist);

    // keep in sync with prop
    useEffect(() => {
        setAdded(!!isInWatchlist);
    }, [isInWatchlist]);

    const label = useMemo(() => {
        if (type === 'icon') return added ? '' : '';
        return added ? 'Remove from Watchlist' : 'Add to Watchlist';
    }, [added, type]);

    // Handle adding/removing stocks from watchlist
    const toggleWatchlist = async () => {
        const result = added
            ? await removeFromWatchlist(symbol)
            : await addToWatchlist(symbol, company);

        if (result.success) {
            const next = !added;
            toast.success(added ? 'Removed from Watchlist' : 'Added to Watchlist', {
                description: `${company} ${added ? 'removed from' : 'added to'} your watchlist`,
            });

            onWatchlistChange?.(symbol, next);       // existing local sync
            emitWatchlistUpdate({ symbol, isAdded: next }); // 🔔 broadcast to everyone
        } else {
            // (optional) revert optimistic UI on failure
            setAdded(added);
        }
    };

    // Debounce the toggle function to prevent rapid API calls (300ms delay)
    const debouncedToggle = useDebounce(toggleWatchlist, 300);

    // Click handler that provides optimistic UI updates
    const handleClick = (e: React.MouseEvent) => {
        // Prevent event bubbling and default behavior
        e.stopPropagation();
        e.preventDefault();

        setAdded(!added);
        debouncedToggle();
    };

    if (type === 'icon') {
        return (
            <button
                title={
                    added
                        ? `Remove ${symbol} from watchlist`
                        : `Add ${symbol} to watchlist`
                }
                aria-label={
                    added
                        ? `Remove ${symbol} from watchlist`
                        : `Add ${symbol} to watchlist`
                }
                className={`watchlist-icon-btn ${added ? 'watchlist-icon-added' : ''}`}
                onClick={handleClick}
            >
                <Star fill={added ? 'currentColor' : 'none'} />
            </button>
        );
    }

    return (
        <button
            className={`watchlist-btn ${added ? 'watchlist-remove' : ''}`}
            onClick={handleClick}
        >
            {showTrashIcon && added ? <Trash2 /> : null}
            <span>{label}</span>
        </button>
    );
};

export default WatchlistButton;