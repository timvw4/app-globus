import type { Order, OrderStatus } from '../types';
import { timeToMinutes } from './operatingHours';

/** Extrait l'heure de fin d'un créneau (ex: "17:00-19:00" ou "17h00 – 19h00") */
export function parseTimeSlotEndMinutes(slot: string): number | null {
  const standardMatch = slot.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (standardMatch?.[2]) {
    return timeToMinutes(standardMatch[2]);
  }

  const labelMatch = slot.match(/(\d{1,2})h(\d{2})\s*[–-]\s*(\d{1,2})h(\d{2})/);
  if (labelMatch) {
    const hours = Number(labelMatch[3]);
    const minutes = Number(labelMatch[4]);
    return hours * 60 + minutes;
  }

  return null;
}

function buildDeliveryEndDate(requestedDate: string, requestedTimeSlot: string | null): Date | null {
  const [year, month, day] = requestedDate.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  if (requestedTimeSlot) {
    const endMinutes = parseTimeSlotEndMinutes(requestedTimeSlot);
    if (endMinutes === null) {
      return new Date(year, month - 1, day, 23, 59, 59);
    }
    return new Date(year, month - 1, day, Math.floor(endMinutes / 60), endMinutes % 60);
  }

  return new Date(year, month - 1, day, 23, 59, 59);
}

/**
 * Retourne le statut effectif d'une commande pour l'affichage.
 * Si la date/créneau de livraison est dépassé(e), la commande est considérée comme livrée,
 * sauf si elle a été annulée.
 */
export function getEffectiveOrderStatus(
  order: Pick<Order, 'status' | 'requested_date' | 'requested_time_slot'>,
  now: Date = new Date(),
): OrderStatus {
  if (order.status === 'annulee' || order.status === 'livree') {
    return order.status;
  }

  if (!order.requested_date) {
    return order.status;
  }

  const deliveryEnd = buildDeliveryEndDate(order.requested_date, order.requested_time_slot);
  if (!deliveryEnd) {
    return order.status;
  }

  if (now > deliveryEnd) {
    return 'livree';
  }

  return order.status;
}
