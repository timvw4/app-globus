import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { Order, PickupLocation, Profile } from '@globus/core/types';
import { PICKUP_OTHER_VALUE } from '@globus/core/types';

interface OrderEmailProps {
  order: Order;
  pickupLocations: PickupLocation[];
  creator?: Profile | null;
  recipientType: 'dispatch' | 'globus';
  showPricing?: boolean;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Text style={{ margin: '4px 0', fontSize: '14px' }}>
      <strong>{label} :</strong> {value}
    </Text>
  );
}

export function OrderConfirmationEmail({
  order,
  pickupLocations,
  creator,
  recipientType,
  showPricing = false,
}: OrderEmailProps) {
  const pickupLabel =
    order.pickup_location_id
      ? pickupLocations.find((l) => l.id === order.pickup_location_id)?.label
      : order.pickup_address_custom;

  // Compatibilité avec les commandes « un seul colis » créées avant la mise à jour
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

  const preview =
    recipientType === 'dispatch'
      ? `Nouvelle course Globus — ${order.delivery_address}`
      : `Récapitulatif de votre commande — ${order.delivery_address}`;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f8fafc' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading style={{ fontSize: '20px', color: '#334155' }}>
            {recipientType === 'dispatch'
              ? 'Nouvelle course de livraison — Globus'
              : 'Récapitulatif de commande — Globus Livraison'}
          </Heading>
          <Hr />
          <Section>
            <Heading as="h2" style={{ fontSize: '16px', color: '#64748b' }}>
              Départ
            </Heading>
            <Row label="Lieu de départ" value={pickupLabel} />
          </Section>
          <Section>
            <Heading as="h2" style={{ fontSize: '16px', color: '#64748b' }}>
              Destination
            </Heading>
            <Row label="Destinataire" value={order.client_name} />
            <Row label="Téléphone" value={order.client_phone} />
            <Row label="Adresse" value={order.delivery_address} />
            <Row label="Étage" value={order.floor} />
            <Row label="Type d'accès" value={order.access_type} />
            <Row label="Détail d'accès" value={order.access_detail} />
            {order.is_hotel && <Row label="Hôtel" value={order.hotel_name} />}
            {order.is_hotel && <Row label="Chambre" value={order.hotel_room_number} />}
            <Row label="Laisser devant la porte" value={order.leave_at_door ? 'Oui' : null} />
            <Row label="Instructions" value={order.special_instructions} />
            {showPricing && (
              <Row label="Montant facturé" value={order.price_chf ? `${order.price_chf} CHF` : null} />
            )}
          </Section>
          <Section>
            <Heading as="h2" style={{ fontSize: '16px', color: '#64748b' }}>
              Planification
            </Heading>
            <Row label="Date souhaitée" value={order.requested_date} />
            <Row label="Créneau" value={order.requested_time_slot} />
            <Row label="Informations spécifiques" value={order.time_slot_notes} />
          </Section>
          <Section>
            <Heading as="h2" style={{ fontSize: '16px', color: '#64748b' }}>
              Colis ({packages.length})
            </Heading>
            {packages.map((pkg, index) => (
              <div key={index} style={{ marginBottom: '12px' }}>
                <Text style={{ margin: '8px 0 4px', fontSize: '14px', fontWeight: 'bold' }}>
                  Colis {index + 1}
                </Text>
                <Row label="N° sac/colis" value={pkg.bag_number} />
                <Row label="Contenu" value={pkg.description} />
                <Row label="Poids" value={pkg.weight ? `${pkg.weight} kg` : null} />
                <Row label="Dimensions" value={pkg.dimensions} />
                <Row label="Très fragile" value={pkg.fragile ? 'Oui' : null} />
                <Row label="Périssable" value={pkg.perishable ? 'Oui' : null} />
                <Row
                  label="Valeur déclarée"
                  value={pkg.declared_value_chf ? `${pkg.declared_value_chf} CHF` : null}
                />
                <Row label="Assurance complémentaire" value={pkg.extra_insurance ? 'Oui' : null} />
                <Row label="Photo" value={pkg.goods_photo_url ? pkg.goods_photo_url : null} />
              </div>
            ))}
          </Section>
          {creator && (
            <Section>
              <Row label="Commandé par" value={creator.full_name} />
            </Section>
          )}
          <Hr />
          <Text style={{ fontSize: '12px', color: '#94a3b8' }}>
            Globus Livraison — La Vélopostale
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
