import { describe, it, expect } from 'vitest';
import { getEffectiveOrderStatus, parseTimeSlotEndMinutes } from './orderStatus';
import type { OrderStatus } from '../types';

function makeOrder(overrides: {
  status: OrderStatus;
  requested_date?: string | null;
  requested_time_slot?: string | null;
}) {
  return {
    status: overrides.status,
    requested_date: overrides.requested_date ?? null,
    requested_time_slot: overrides.requested_time_slot ?? null,
  };
}

describe('parseTimeSlotEndMinutes', () => {
  it('lit la fin d un créneau au format stocké', () => {
    expect(parseTimeSlotEndMinutes('17:00-19:00')).toBe(19 * 60);
  });

  it('lit la fin d un créneau au format affiché', () => {
    expect(parseTimeSlotEndMinutes('17h00 – 19h00')).toBe(19 * 60);
  });
});

describe('getEffectiveOrderStatus', () => {
  it('affiche livrée quand la date et le créneau sont passés', () => {
    const order = makeOrder({
      status: 'created',
      requested_date: '2026-06-26',
      requested_time_slot: '17:00-19:00',
    });
    const now = new Date('2026-06-28T10:00:00');

    expect(getEffectiveOrderStatus(order, now)).toBe('livree');
  });

  it('conserve le statut en cours pendant le créneau', () => {
    const order = makeOrder({
      status: 'en_cours',
      requested_date: '2026-06-26',
      requested_time_slot: '17:00-19:00',
    });
    const now = new Date('2026-06-26T18:00:00');

    expect(getEffectiveOrderStatus(order, now)).toBe('en_cours');
  });

  it('affiche livrée juste après la fin du créneau', () => {
    const order = makeOrder({
      status: 'created',
      requested_date: '2026-06-26',
      requested_time_slot: '17:00-19:00',
    });
    const now = new Date('2026-06-26T19:01:00');

    expect(getEffectiveOrderStatus(order, now)).toBe('livree');
  });

  it('ne modifie pas une commande annulée', () => {
    const order = makeOrder({
      status: 'annulee',
      requested_date: '2026-06-26',
      requested_time_slot: '17:00-19:00',
    });
    const now = new Date('2026-06-28T10:00:00');

    expect(getEffectiveOrderStatus(order, now)).toBe('annulee');
  });

  it('affiche livrée sans créneau quand la date est passée', () => {
    const order = makeOrder({
      status: 'created',
      requested_date: '2026-06-26',
      requested_time_slot: null,
    });
    const now = new Date('2026-06-28T10:00:00');

    expect(getEffectiveOrderStatus(order, now)).toBe('livree');
  });
});
