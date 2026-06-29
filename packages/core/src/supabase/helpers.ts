import type { TypedSupabaseClient } from './client';
import type {
  AppSettings,
  Profile,
  PickupLocation,
  PricingRule,
  DeliveryOptionConfig,
  PackageItem,
} from '../types';
import { DEFAULT_CUTOFFS, DEFAULT_OPERATING_HOURS } from '../business/operatingHours';
import { getNextBagNumber } from '../business/bagNumber';

const SETTINGS_KEY = 'app_settings';

/** Récupère le profil de l'utilisateur connecté */
export async function getProfile(
  client: TypedSupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data as Profile;
}

/** Vérifie si l'utilisateur est admin */
export async function isAdmin(client: TypedSupabaseClient, userId: string): Promise<boolean> {
  const profile = await getProfile(client, userId);
  return profile?.role === 'admin' && profile.active;
}

/** Récupère les paramètres applicatifs (horaires, cutoffs, email Globus) */
export async function getAppSettings(client: TypedSupabaseClient): Promise<AppSettings> {
  const { data } = await client.from('settings').select('value').eq('key', SETTINGS_KEY).single();

  const stored = (data?.value ?? {}) as Partial<AppSettings>;

  // On fusionne avec les valeurs par défaut pour qu'un paramétrage partiel
  // (par ex. un jour d'horaire manquant) ne casse pas l'application.
  return {
    operating_hours: {
      ...DEFAULT_OPERATING_HOURS,
      ...(stored.operating_hours ?? {}),
    },
    cutoffs: {
      ...DEFAULT_CUTOFFS,
      ...(stored.cutoffs ?? {}),
    },
    globus_notification_email:
      stored.globus_notification_email ?? 'livraison@globus.ch',
  };
}

/** Récupère les lieux de départ actifs */
export async function getActivePickupLocations(
  client: TypedSupabaseClient,
): Promise<PickupLocation[]> {
  const { data, error } = await client
    .from('pickup_locations')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PickupLocation[];
}

/** Récupère la règle tarifaire active */
export async function getActivePricingRule(
  client: TypedSupabaseClient,
): Promise<PricingRule | null> {
  const { data, error } = await client
    .from('pricing_rules')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as PricingRule;
}

/**
 * Calcule le prochain numéro de sac / colis encore libre,
 * en parcourant les colis de toutes les commandes existantes.
 */
export async function getNextAvailableBagNumber(
  client: TypedSupabaseClient,
): Promise<string> {
  const { data, error } = await client.from('orders').select('packages');

  if (error || !data) return getNextBagNumber([]);

  const used: (string | null | undefined)[] = [];
  for (const row of data as { packages: PackageItem[] | null }[]) {
    for (const pkg of row.packages ?? []) {
      used.push(pkg?.bag_number);
    }
  }

  return getNextBagNumber(used);
}

/** Récupère les options de livraison activées */
export async function getEnabledDeliveryOptions(
  client: TypedSupabaseClient,
): Promise<DeliveryOptionConfig[]> {
  const { data, error } = await client
    .from('delivery_options_config')
    .select('*')
    .eq('enabled', true);

  if (error) throw error;
  return (data ?? []) as DeliveryOptionConfig[];
}
