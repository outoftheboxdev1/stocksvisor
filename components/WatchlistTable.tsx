'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { WATCHLIST_TABLE_HEADER } from '@/lib/constants';
import { Button } from './ui/button';
import { WatchlistButton } from '@/components/WatchlistButton';
import { useRouter } from 'next/navigation';
import { cn, getChangeColorClass } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getStockAlertForSymbol, updateStockAlert, deleteStockAlertForSymbol } from '@/lib/actions/alerts.actions';

export function WatchlistTable({ watchlist }: WatchlistTableProps) {
    const router = useRouter();

    // Local per-row dialog state keyed by symbol
    const [openFor, setOpenFor] = useState<string | null>(null);
    const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
    const [percent, setPercent] = useState<string>('5');
    const [hasExisting, setHasExisting] = useState<boolean>(false);

    // Load existing alert when dialog opens for a symbol
    useEffect(() => {
        const load = async () => {
            if (!openFor) return;
            try {
                const res = await getStockAlertForSymbol(openFor);
                if (res.success && res.alert) {
                    setDirection(res.alert.direction);
                    setPercent(String(res.alert.thresholdPercent));
                    setHasExisting(true);
                } else {
                    setDirection('UP');
                    setPercent('5');
                    setHasExisting(false);
                }
            } catch (e) {
                setHasExisting(false);
            }
        };
        load();
    }, [openFor]);

    const handleSave = async (symbol: string) => {
        const val = parseFloat(percent);
        if (isNaN(val) || val <= 0) {
            toast.error('Enter a valid percentage (> 0)');
            return;
        }
        try {
            const res = await updateStockAlert({ symbol, direction, thresholdPercent: val });
            if (res?.success) {
                toast.success('Alert saved', { description: `${symbol} • ${direction} • ${val}%` });
                setOpenFor(null);
            } else {
                toast.error(res?.message || 'Failed to save alert');
            }
        } catch (e) {
            toast.error('Failed to save alert');
        }
    };

    const handleDelete = async (symbol: string) => {
        try {
            const res = await deleteStockAlertForSymbol(symbol);
            if (res?.success) {
                toast.success('Alert deleted', { description: `${symbol}` });
                setOpenFor(null);
            } else {
                toast.error(res?.message || 'Failed to delete alert');
            }
        } catch (e) {
            toast.error('Failed to delete alert');
        }
    };

    return (
        <>
            <Table className='scrollbar-hide-default watchlist-table'>
                <TableHeader>
                    <TableRow className='table-header-row'>
                        {WATCHLIST_TABLE_HEADER.map((label) => (
                            <TableHead className='table-header' key={label}>
                                {label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {watchlist.map((item, index) => (
                        <TableRow
                            key={item.symbol + index}
                            className='table-row'
                            onClick={() =>
                                router.push(`/stocks/${encodeURIComponent(item.symbol)}`)
                            }
                        >
                            <TableCell className='pl-4 table-cell'>{item.company}</TableCell>
                            <TableCell className='table-cell'>{item.symbol}</TableCell>
                            <TableCell className='table-cell'>
                                {item.priceFormatted || '—'}
                            </TableCell>
                            <TableCell
                                className={cn(
                                    'table-cell',
                                    getChangeColorClass(item.changePercent)
                                )}
                            >
                                {item.changeFormatted || '—'}
                            </TableCell>
                            <TableCell className='table-cell'>
                                {item.marketCap || '—'}
                            </TableCell>
                            <TableCell className='table-cell'>
                                {item.peRatio || '—'}
                            </TableCell>
                            <TableCell onClick={(e) => { e.stopPropagation(); }}>
                                <Dialog open={openFor === item.symbol} onOpenChange={(o) => setOpenFor(o ? item.symbol : null)}>
                                    <DialogTrigger asChild>
                                        <Button className='add-alert' onClick={(e) => { e.stopPropagation(); }}>
                                            {hasExisting && openFor === item.symbol ? 'Edit Alert' : 'Add Alert'}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className='alert-dialog' onClick={(e) => e.stopPropagation()}>
                                        <DialogHeader>
                                            <DialogTitle>Set Price Alert for {item.symbol}</DialogTitle>
                                        </DialogHeader>
                                        <div className='flex items-center gap-3'>
                                            <Select value={direction} onValueChange={(v) => setDirection(v as 'UP' | 'DOWN')}>
                                                <SelectTrigger aria-label='Direction'>
                                                    <SelectValue placeholder='Direction' />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='UP'>Goes Up</SelectItem>
                                                    <SelectItem value='DOWN'>Goes Down</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <div className='flex items-center gap-2'>
                                                <Input type='number' min='0.1' step='0.1' value={percent}
                                                       onChange={(e) => setPercent(e.target.value)}
                                                       placeholder='%' style={{ width: 100 }} />
                                                <span>%</span>
                                            </div>
                                        </div>
                                        <DialogFooter className='flex gap-2'>
                                            {hasExisting && (
                                                <Button variant='destructive' onClick={() => handleDelete(item.symbol)}>
                                                    Delete
                                                </Button>
                                            )}
                                            <Button onClick={() => handleSave(item.symbol)}>Save Alert</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </TableCell>
                            <TableCell>
                                <WatchlistButton
                                    symbol={item.symbol}
                                    company={item.company}
                                    isInWatchlist={true}
                                    showTrashIcon={true}
                                    type='icon'
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    )
}