import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import {
  createOrderFormSchemaWithContext,
  type OrderFormData,
} from '@globus/core/schemas';
import { PICKUP_OTHER_VALUE } from '@globus/core/types';
import type { Order } from '@globus/core/types';
import { logtechClient } from '@globus/core/integrations';
import {
  getAppSettings,
  getProfile,
} from '@globus/core/supabase';
import { createServerClient } from '@/lib/supabase/server';
import { OrderConfirmationEmail } from '@/emails/order-confirmation';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
    }

    const body = (await request.json()) as OrderFormData;
    const settings = await getAppSettings(supabase);

    const schema = createOrderFormSchemaWithContext({
      operatingHours: settings.operating_hours,
      cutoffs: settings.cutoffs,
      now: new Date(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation échouée', errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const isOtherPickup = data.pickup_location_id === PICKUP_OTHER_VALUE;

    // On nettoie chaque colis avant de l'enregistrer (valeurs vides → null)
    const packages = data.packages.map((pkg) => ({
      bag_number: pkg.bag_number ?? null,
      description: pkg.description,
      weight: pkg.weight,
      dimensions: pkg.dimensions ?? null,
      fragile: pkg.fragile,
      perishable: pkg.perishable,
      declared_value_chf:
        typeof pkg.declared_value_chf === 'number' ? pkg.declared_value_chf : null,
      extra_insurance: pkg.extra_insurance,
      goods_photo_url: pkg.goods_photo_url ?? null,
    }));

    const orderInsert = {
      pickup_location_id: isOtherPickup ? null : data.pickup_location_id,
      pickup_address_custom: isOtherPickup ? data.pickup_address_custom ?? null : null,
      delivery_address: data.delivery_address,
      access_type: data.access_type,
      access_detail: data.access_detail ?? null,
      is_hotel: data.is_hotel,
      hotel_room_number: data.hotel_room_number ?? null,
      floor: data.floor ?? null,
      client_name: data.client_name ?? null,
      client_phone: data.client_phone ?? null,
      requested_date: data.requested_date || null,
      requested_time_slot: data.requested_time_slot || null,
      leave_at_door: data.leave_at_door,
      special_instructions: data.special_instructions ?? null,
      packages,
      price_chf: typeof data.price_chf === 'number' ? data.price_chf : null,
      created_by: user.id,
      status: 'created' as const,
    };

    const db = supabase as ReturnType<typeof createServerClient> extends Promise<infer T> ? T : never;

    const { data: orderData, error } = await db
      .from('orders')
      .insert(orderInsert as never)
      .select()
      .single();

    const order = orderData as Order | null;

    if (error || !order) {
      console.error('Order insert error:', error);
      return NextResponse.json({ message: 'Erreur lors de la création' }, { status: 500 });
    }

    // TODO: Intégration Logtech — stub pour l'instant
    const pickupAddress = isOtherPickup
      ? (data.pickup_address_custom ?? '')
      : '';
    try {
      const logtechResult = await logtechClient.createOrder(order, pickupAddress);
      await db
        .from('orders')
        .update({ logtech_ref: logtechResult.logtechRef } as never)
        .eq('id', order.id);
    } catch {
      // Logtech non implémenté — on continue
    }

    // Envoi des emails
    const { data: pickupLocations } = await supabase.from('pickup_locations').select('*');
    const creator = await getProfile(supabase, user.id);

    const dispatchEmail =
      process.env.DISPATCH_EMAIL ?? 'dispo@coursier.ch';
    const globusEmail =
      process.env.GLOBUS_NOTIFICATION_EMAIL ?? settings.globus_notification_email;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

    if (process.env.RESEND_API_KEY) {
      const resend = getResend();
      if (!resend) {
        return NextResponse.json({ id: order.id });
      }
      const locations = pickupLocations ?? [];

      const dispatchHtml = await render(
        OrderConfirmationEmail({
          order,
          pickupLocations: locations,
          creator,
          recipientType: 'dispatch',
        }),
      );

      const globusHtml = await render(
        OrderConfirmationEmail({
          order,
          pickupLocations: locations,
          creator,
          recipientType: 'globus',
        }),
      );

      await Promise.allSettled([
        resend.emails.send({
          from: fromEmail,
          to: dispatchEmail,
          subject: `[Globus] Nouvelle course — ${order.delivery_address}`,
          html: dispatchHtml,
        }),
        resend.emails.send({
          from: fromEmail,
          to: [globusEmail, user.email!].filter(Boolean),
          subject: `[Globus] Récapitulatif commande — ${order.delivery_address}`,
          html: globusHtml,
        }),
      ]);
    }

    return NextResponse.json({ id: order.id });
  } catch (e) {
    console.error('API orders error:', e);
    return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
  }
}
