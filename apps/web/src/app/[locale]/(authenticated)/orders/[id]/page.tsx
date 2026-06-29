import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Order } from '@globus/core/types';
import { getEffectiveOrderStatus } from '@globus/core/business';
import { notFound } from 'next/navigation';
import { getActivePickupLocations } from '@globus/core/supabase';
import { requireAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PrintButton } from '@/components/orders/print-button';
import { formatCHF, formatDate, formatDateTime } from '@/lib/utils';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { supabase } = await requireAuth(locale);
  const t = await getTranslations('order');

  const [{ data: orderData }, pickupLocations] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).single(),
    getActivePickupLocations(supabase),
  ]);

  const order = orderData as Order | null;

  if (!order) notFound();

  const pickupLabel = order.pickup_address_custom
    ? order.pickup_address_custom
    : pickupLocations.find((l) => l.id === order.pickup_location_id)?.label ?? '—';

  // Compatibilité : si la commande a été créée avant la mise à jour « multi-colis »,
  // on reconstruit un colis unique à partir des anciens champs.
  const packages =
    order.packages && order.packages.length > 0
      ? order.packages
      : [
          {
            bag_number: null,
            description: '',
            weight: order.weight ?? 0,
            dimensions: order.dimensions ?? null,
            fragile: order.fragile ?? false,
            perishable: order.perishable ?? false,
            declared_value_chf: order.declared_value_chf ?? null,
            extra_insurance: order.extra_insurance ?? false,
            goods_photo_url: order.goods_photo_url ?? null,
          },
        ];

  const effectiveStatus = getEffectiveOrderStatus(order);

  const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
    created: 'secondary',
    en_cours: 'warning',
    livree: 'success',
    annulee: 'destructive',
  };

  function Row({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
      <div className="flex justify-between py-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-right max-w-[60%]">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre d'actions — non imprimée */}
      <div className="flex items-center justify-between no-print">
        <Button variant="outline" asChild>
          <Link href={`/${locale}/orders`}>← {t('historyTitle')}</Link>
        </Button>
        <PrintButton />
      </div>

      {/* Zone imprimable — la fiche de livraison complète */}
      <div className="print-area space-y-6">
        {/* En-tête visible uniquement à l'impression */}
        <div className="print-only">
          <h2 className="text-xl font-bold">Globus Livraison — Fiche de livraison</h2>
          <Separator className="my-2" />
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('detailTitle')}</h1>
          <Badge variant={statusVariant[effectiveStatus] ?? 'default'}>
            {t(`status.${effectiveStatus}`)}
          </Badge>
        </div>

        <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sections.pickup')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label={t('fields.pickupLocation')} value={pickupLabel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sections.delivery')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <Row label={t('fields.deliveryAddress')} value={order.delivery_address} />
          <Row label={t('fields.accessType')} value={t(`accessTypes.${order.access_type}`)} />
          <Row label={t('fields.accessDetail')} value={order.access_detail} />
          {order.is_hotel && <Row label={t('fields.hotelRoom')} value={order.hotel_room_number} />}
          <Row label={t('fields.floor')} value={order.floor} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sections.scheduling')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label={t('fields.requestedDate')} value={formatDate(order.requested_date)} />
          <Row label={t('fields.requestedTimeSlot')} value={order.requested_time_slot} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sections.characteristics')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {packages.map((pkg, index) => (
            <div key={index} className="rounded-lg border border-border p-4">
              <p className="font-semibold text-sm mb-2">
                {t('fields.packageTitle', { number: index + 1 })}
              </p>
              <Row label={t('fields.bagNumber')} value={pkg.bag_number} />
              <Row label={t('fields.packageDescription')} value={pkg.description} />
              <Row label={t('fields.weight')} value={pkg.weight ? `${pkg.weight} kg` : null} />
              <Row label={t('fields.dimensions')} value={pkg.dimensions} />
              <Row label={t('fields.fragile')} value={pkg.fragile ? 'Oui' : null} />
              <Row label={t('fields.perishable')} value={pkg.perishable ? 'Oui' : null} />
              <Row
                label={t('fields.declaredValue')}
                value={pkg.declared_value_chf ? formatCHF(pkg.declared_value_chf) : null}
              />
              <Row label={t('fields.extraInsurance')} value={pkg.extra_insurance ? 'Oui' : null} />
              {pkg.goods_photo_url && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">{t('fields.goodsPhoto')}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pkg.goods_photo_url}
                    alt="Photo marchandise"
                    className="max-w-xs rounded-md border"
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sections.recipient')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label={t('fields.clientName')} value={order.client_name} />
          <Row label={t('fields.clientPhone')} value={order.client_phone} />
          <Row label={t('fields.leaveAtDoor')} value={order.leave_at_door ? 'Oui' : null} />
          <Row label={t('fields.specialInstructions')} value={order.special_instructions} />
        </CardContent>
      </Card>

        <Card>
          <CardContent className="pt-6">
            <Separator className="mb-4" />
            <Row label={t('fields.price')} value={formatCHF(order.price_chf)} />
            <Row label={t('fields.createdAt')} value={formatDateTime(order.created_at)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
