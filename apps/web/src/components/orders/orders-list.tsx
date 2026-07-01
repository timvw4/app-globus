'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Order, PickupLocation } from '@globus/core/types';
import { getEffectiveOrderStatus } from '@globus/core/business';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { formatCHF, formatDate, formatDateTime } from '@/lib/utils';

interface OrdersListProps {
  locale: string;
  orders: Order[];
  pickupLocations: PickupLocation[];
  showPricing: boolean;
}

export function OrdersList({ locale, orders, pickupLocations, showPricing }: OrdersListProps) {
  const t = useTranslations();
  const [statusFilter, setStatusFilter] = useState('all');
  const [pickupFilter, setPickupFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = orders.filter((order) => {
    const effectiveStatus = getEffectiveOrderStatus(order);
    if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
    if (pickupFilter !== 'all' && order.pickup_location_id !== pickupFilter) return false;
    if (dateFrom && order.created_at < dateFrom) return false;
    if (dateTo && order.created_at > dateTo + 'T23:59:59') return false;
    return true;
  });

  function getPickupLabel(order: Order) {
    if (order.pickup_address_custom) return order.pickup_address_custom;
    return pickupLocations.find((l) => l.id === order.pickup_location_id)?.label ?? '—';
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>{t('order.filters.status')}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('order.filters.all')}</SelectItem>
                  {(['created', 'en_cours', 'livree', 'annulee'] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`order.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('order.filters.pickupLocation')}</Label>
              <Select value={pickupFilter} onValueChange={setPickupFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('order.filters.all')}</SelectItem>
                  {pickupLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('order.filters.dateFrom')}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('order.filters.dateTo')}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('common.noResults')}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            return (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(order.created_at)}
                    </span>
                    <p className="font-medium">{order.delivery_address}</p>
                    <p className="text-sm text-muted-foreground">
                      {getPickupLabel(order)}
                      {order.requested_date && ` — ${formatDate(order.requested_date)}`}
                      {order.requested_time_slot && ` (${order.requested_time_slot})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {showPricing && (
                      <span className="font-semibold">{formatCHF(order.price_chf)}</span>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${locale}/orders/${order.id}`}>{t('common.detail')}</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
