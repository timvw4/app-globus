'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { OrderFormData } from '@globus/core/schemas';
import { PICKUP_OTHER_VALUE } from '@globus/core/types';
import type { PickupLocation } from '@globus/core/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PrintButton } from '@/components/orders/print-button';
import { formatCHF } from '@/lib/utils';

const ORDER_DRAFT_KEY = 'globus_order_draft';

interface ReviewDisplayProps {
  locale: string;
  pickupLocations: PickupLocation[];
}

function ReviewRow({ label, value }: { label: string; value: string | boolean | number | null | undefined }) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  const display = typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value);
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{display}</span>
    </div>
  );
}

export function OrderReview({ locale, pickupLocations }: ReviewDisplayProps) {
  const t = useTranslations();
  const router = useRouter();
  const [data, setData] = useState<OrderFormData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const draft = sessionStorage.getItem(ORDER_DRAFT_KEY);
    if (!draft) {
      router.replace(`/${locale}/orders/new`);
      return;
    }
    try {
      setData(JSON.parse(draft));
    } catch {
      router.replace(`/${locale}/orders/new`);
    }
  }, [locale, router]);

  if (!data) return <p>{t('common.loading')}</p>;

  const pickupLabel =
    data.pickup_location_id === PICKUP_OTHER_VALUE
      ? data.pickup_address_custom
      : pickupLocations.find((l) => l.id === data.pickup_location_id)?.label;

  async function handleConfirm() {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || t('common.error'));
      }

      const result = await res.json();
      sessionStorage.removeItem(ORDER_DRAFT_KEY);
      router.push(`/${locale}/orders/${result.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="print-area space-y-6">
        {/* En-tête visible uniquement à l'impression */}
        <div className="print-only">
          <h2 className="text-xl font-bold">Globus Livraison — Fiche de livraison</h2>
          <Separator className="my-2" />
        </div>
        <Card>
        <CardHeader>
          <CardTitle>{t('order.reviewTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            {t('order.sections.pickup')}
          </h3>
          <ReviewRow label={t('order.fields.pickupLocation')} value={pickupLabel} />
          <Separator />
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            {t('order.sections.delivery')}
          </h3>
          <ReviewRow label={t('order.fields.deliveryAddress')} value={data.delivery_address} />
          <ReviewRow
            label={t('order.fields.accessType')}
            value={t(`order.accessTypes.${data.access_type}`)}
          />
          <ReviewRow label={t('order.fields.accessDetail')} value={data.access_detail} />
          <ReviewRow label={t('order.fields.isHotel')} value={data.is_hotel} />
          <ReviewRow label={t('order.fields.hotelRoom')} value={data.hotel_room_number} />
          <Separator />
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            {t('order.sections.scheduling')}
          </h3>
          <ReviewRow label={t('order.fields.requestedDate')} value={data.requested_date} />
          <ReviewRow label={t('order.fields.requestedTimeSlot')} value={data.requested_time_slot} />
          <Separator />
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            {t('order.sections.characteristics')}
          </h3>
          {(data.packages ?? []).map((pkg, index) => (
            <div key={index} className="rounded-md border border-border p-3 my-2">
              <p className="font-semibold text-sm mb-1">
                {t('order.fields.packageTitle', { number: index + 1 })}
              </p>
              <ReviewRow label={t('order.fields.bagNumber')} value={pkg.bag_number} />
              <ReviewRow label={t('order.fields.packageDescription')} value={pkg.description} />
              <ReviewRow
                label={t('order.fields.weight')}
                value={pkg.weight ? `${pkg.weight} kg` : null}
              />
              <ReviewRow label={t('order.fields.dimensions')} value={pkg.dimensions} />
              <ReviewRow label={t('order.fields.fragile')} value={pkg.fragile} />
              <ReviewRow label={t('order.fields.perishable')} value={pkg.perishable} />
              <ReviewRow
                label={t('order.fields.declaredValue')}
                value={pkg.declared_value_chf ? formatCHF(Number(pkg.declared_value_chf)) : null}
              />
              <ReviewRow label={t('order.fields.extraInsurance')} value={pkg.extra_insurance} />
              {pkg.goods_photo_url && (
                <ReviewRow label={t('order.fields.goodsPhoto')} value="Photo jointe" />
              )}
            </div>
          ))}
          <Separator />
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            {t('order.sections.recipient')}
          </h3>
          <ReviewRow label={t('order.fields.clientName')} value={data.client_name} />
          <ReviewRow label={t('order.fields.clientPhone')} value={data.client_phone} />
          <ReviewRow label={t('order.fields.floor')} value={data.floor} />
          <ReviewRow label={t('order.fields.leaveAtDoor')} value={data.leave_at_door} />
          <ReviewRow label={t('order.fields.specialInstructions')} value={data.special_instructions} />
          <Separator />
          <ReviewRow
            label={t('order.fields.price')}
            value={formatCHF(Number(data.price_chf))}
          />
        </CardContent>
      </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3 no-print">
        <Button variant="outline" onClick={() => router.push(`/${locale}/orders/new`)}>
          {t('common.back')}
        </Button>
        <PrintButton />
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? t('common.loading') : t('order.actions.confirmOrder')}
        </Button>
      </div>
    </div>
  );
}
