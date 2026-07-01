import type { Order, PackageItem } from '../types';
import { parseDimensionsCm, parseSwissAddress, type ParsedSwissAddress } from '../business/swissAddress';
import { parseTimeSlotEndMinutes } from '../business/orderStatus';

/** Contexte nécessaire pour envoyer une commande à Logtech */
export interface LogtechOrderContext {
  /** Adresse texte du lieu de ramassage (label Globus ou adresse libre) */
  pickupAddress: string;
  /** Nom du collaborateur qui passe la commande (optionnel) */
  orderedBy?: string | null;
}

/** Réponse de création Logtech */
export interface LogtechOrderResponse {
  logtechRef: string;
  status: string;
}

export interface LogtechClient {
  createOrder(order: Order, context: LogtechOrderContext): Promise<LogtechOrderResponse>;
  getOrderStatus(logtechRef: string): Promise<string>;
  cancelOrder(logtechRef: string): Promise<void>;
}

export interface LogtechClientConfig {
  baseUrl: string;
  apiKey: string;
}

/** Note Logtech (instructions pour le coursier, dispatch, etc.) */
interface LogtechNote {
  note: string;
  audience: Array<'contact_person' | 'courier' | 'dispatcher' | 'customer' | 'clearing'>;
}

interface LogtechAddressPayload {
  person?: string;
  company?: string;
  street: string;
  streetNumber?: string;
  streetNumberSuffix?: string;
  zip?: string;
  city?: string;
  country?: string;
}

interface LogtechStopPayload {
  address: LogtechAddressPayload;
  contactPhone?: string;
  contactPerson?: string;
  dateTimeFrom?: string;
  dateTimeTo?: string;
  notes?: LogtechNote[];
}

interface LogtechShipmentPayload {
  count?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  weight_kg?: number;
  description?: string;
}

function toLogtechAddress(parsed: ParsedSwissAddress, extras?: { person?: string; company?: string }): LogtechAddressPayload {
  return {
    person: extras?.person,
    company: extras?.company,
    street: parsed.street,
    streetNumber: parsed.streetNumber,
    streetNumberSuffix: parsed.streetNumberSuffix,
    zip: parsed.zip,
    city: parsed.city,
    country: parsed.country,
  };
}

/** Extrait l'heure de début d'un créneau (ex: "17:00-19:00") */
function parseTimeSlotStartMinutes(slot: string): number | null {
  const standardMatch = slot.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (standardMatch?.[1]) {
    const [hoursStr, minutesStr] = standardMatch[1].split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  }
  return null;
}

function buildIsoDateTime(date: string, minutesFromMidnight: number): string {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+02:00`;
}

function buildOrderNotes(order: Order): LogtechNote[] {
  const notes: LogtechNote[] = [];
  const audience: LogtechNote['audience'] = ['courier', 'dispatcher'];

  if (order.special_instructions?.trim()) {
    notes.push({ note: order.special_instructions.trim(), audience });
  }

  if (order.access_detail?.trim()) {
    notes.push({
      note: `Accès (${order.access_type}) : ${order.access_detail.trim()}`,
      audience,
    });
  }

  if (order.is_hotel && order.hotel_name) {
    const room = order.hotel_room_number ? `, ch. ${order.hotel_room_number}` : '';
    notes.push({ note: `Hôtel : ${order.hotel_name}${room}`, audience });
  }

  if (order.floor?.trim()) {
    notes.push({ note: `Étage : ${order.floor.trim()}`, audience });
  }

  if (order.leave_at_door) {
    notes.push({ note: 'Autorisation de déposer devant la porte', audience });
  }

  if (order.time_slot_notes?.trim()) {
    notes.push({ note: order.time_slot_notes.trim(), audience });
  }

  return notes;
}

function packageToShipment(pkg: PackageItem): LogtechShipmentPayload {
  const dims = parseDimensionsCm(pkg.dimensions);
  const descriptionParts = [pkg.description?.trim(), pkg.bag_number ? `Sac ${pkg.bag_number}` : null]
    .filter(Boolean)
    .join(' — ');

  return {
    count: 1,
    weight_kg: pkg.weight,
    description: descriptionParts || 'Colis Globus',
    ...dims,
  };
}

/** Adresse client Globus (facturation) envoyée à Logtech — requise en production */
function buildCustomerAddress(): LogtechAddressPayload {
  const raw =
    readEnv('LOGTECH_CUSTOMER_ADDRESS') || 'Rue du Rhône 48, 1204 Genève';
  const company = readEnv('LOGTECH_CUSTOMER_COMPANY') || 'Globus Genève';
  return toLogtechAddress(parseSwissAddress(raw), { company });
}

/** Transforme une commande du portail au format JSON Logtech */
export function mapOrderToLogtechPayload(order: Order, context: LogtechOrderContext) {
  const deliveryParsed = parseSwissAddress(order.delivery_address);
  const pickupParsed = parseSwissAddress(context.pickupAddress);

  const deliveryStop: LogtechStopPayload = {
    address: toLogtechAddress(deliveryParsed, {
      person: order.client_name ?? undefined,
      company: order.is_hotel ? order.hotel_name ?? undefined : undefined,
    }),
    contactPhone: order.client_phone ?? undefined,
    contactPerson: order.client_name ?? undefined,
    notes: buildOrderNotes(order),
  };

  const pickupStop: LogtechStopPayload = {
    address: toLogtechAddress(pickupParsed, { company: 'Globus Genève' }),
    notes: [
      {
        note: `Lieu de départ Globus : ${context.pickupAddress}`,
        audience: ['dispatcher', 'courier'],
      },
    ],
  };

  if (order.requested_date && order.requested_time_slot) {
    const startMinutes = parseTimeSlotStartMinutes(order.requested_time_slot);
    const endMinutes = parseTimeSlotEndMinutes(order.requested_time_slot);
    if (startMinutes !== null) {
      deliveryStop.dateTimeFrom = buildIsoDateTime(order.requested_date, startMinutes);
    }
    if (endMinutes !== null) {
      deliveryStop.dateTimeTo = buildIsoDateTime(order.requested_date, endMinutes);
    }
  }

  // Alerte le dispatcher dès la création ; le créneau de livraison reste sur deliveryStop.
  const referenceTime = new Date().toISOString();

  const packages = order.packages?.length ? order.packages : [];
  const shipments = packages.length > 0 ? packages.map(packageToShipment) : [{ count: 1, description: 'Colis Globus', weight_kg: 1 }];

  return {
    order: {
      referenceTime,
      customer: {
        address: buildCustomerAddress(),
      },
      // Référence de la commande à un seul endroit (bon de transport) pour éviter
      // qu'elle apparaisse en double/triple chez le dispatcher.
      waybill: {
        identifier: order.id,
      },
      // On garde uniquement le nom du donneur d'ordre pour la facturation ;
      // la référence reste sur le waybill ci-dessus.
      ...(context.orderedBy
        ? { billingRecord: { personWhoOrdered: context.orderedBy } }
        : {}),
      stops: [pickupStop, deliveryStop],
      shipments,
    },
  };
}

export class HttpLogtechClient implements LogtechClient {
  constructor(private readonly config: LogtechClientConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.config.apiKey,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Logtech API ${response.status}: ${body || response.statusText}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async createOrder(order: Order, context: LogtechOrderContext): Promise<LogtechOrderResponse> {
    const payload = mapOrderToLogtechPayload(order, context);
    const result = await this.request<{ uuid: string }>('/api/v2/order', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      logtechRef: result.uuid,
      status: 'created',
    };
  }

  async getOrderStatus(logtechRef: string): Promise<string> {
    const result = await this.request<{ acceptedAt: string | null }>(
      `/api/v2/order/${logtechRef}/acceptance-status`,
    );
    return result.acceptedAt ? 'accepted' : 'pending';
  }

  async cancelOrder(logtechRef: string): Promise<void> {
    await this.request(`/api/v2/order/${logtechRef}`, { method: 'DELETE' });
  }
}

export class StubLogtechClient implements LogtechClient {
  async createOrder(order: Order, _context: LogtechOrderContext): Promise<LogtechOrderResponse> {
    console.warn('[LogtechClient] Stub: createOrder — LOGTECH_API_KEY non configurée');
    return {
      logtechRef: `STUB-${order.id}`,
      status: 'pending',
    };
  }

  async getOrderStatus(logtechRef: string): Promise<string> {
    console.warn('[LogtechClient] Stub: getOrderStatus');
    return `stub-status-${logtechRef}`;
  }

  async cancelOrder(logtechRef: string): Promise<void> {
    console.warn('[LogtechClient] Stub: cancelOrder', logtechRef);
  }
}

function readEnv(name: string): string | undefined {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  return typeof value === 'string' ? value.trim() : undefined;
}

/** Crée un client Logtech (réel si clé présente, sinon stub) */
export function createLogtechClient(config?: Partial<LogtechClientConfig>): LogtechClient {
  const apiKey = config?.apiKey?.trim() || readEnv('LOGTECH_API_KEY');
  const baseUrl =
    config?.baseUrl?.trim() || readEnv('LOGTECH_API_URL') || 'https://api.logtech.ch';

  return apiKey ? new HttpLogtechClient({ baseUrl, apiKey }) : new StubLogtechClient();
}

let cachedClient: LogtechClient | null = null;

/** Retourne un client Logtech mis en cache (préférer createLogtechClient avec config explicite côté Next.js) */
export function getLogtechClient(config?: Partial<LogtechClientConfig>): LogtechClient {
  if (config) {
    return createLogtechClient(config);
  }

  if (cachedClient) return cachedClient;
  cachedClient = createLogtechClient();
  return cachedClient;
}

/** @deprecated Préférer getLogtechClient() — conservé pour compatibilité */
export const logtechClient: LogtechClient = {
  createOrder: (order, context) => getLogtechClient().createOrder(order, context),
  getOrderStatus: (ref) => getLogtechClient().getOrderStatus(ref),
  cancelOrder: (ref) => getLogtechClient().cancelOrder(ref),
};
