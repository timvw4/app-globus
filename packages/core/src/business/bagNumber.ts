/**
 * Gestion des numéros de sac / colis.
 *
 * Format affiché : « colis-001 », « colis-002 », ...
 * On se base sur la partie numérique pour calculer le prochain numéro libre,
 * ce qui reste tolérant si quelqu'un saisit un numéro dans un autre format.
 */

const BAG_NUMBER_PREFIX = 'COLIS-';
const BAG_NUMBER_PAD = 3;

/** Transforme un entier en numéro affichable, ex: 1 → "colis-001" */
export function formatBagNumber(value: number): string {
  return `${BAG_NUMBER_PREFIX}${String(value).padStart(BAG_NUMBER_PAD, '0')}`;
}

/** Extrait la partie numérique d'un numéro de sac, ex: "colis-007" → 7 (ou null) */
export function parseBagNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)\s*$/);
  const digits = match?.[1];
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Renvoie le plus grand numéro déjà utilisé dans une liste (0 si aucun) */
export function getHighestBagNumber(existing: (string | null | undefined)[]): number {
  return existing.reduce<number>((max, value) => {
    const parsed = parseBagNumber(value);
    return parsed != null && parsed > max ? parsed : max;
  }, 0);
}

/** Renvoie le prochain numéro de sac libre, formaté (ex: "colis-008") */
export function getNextBagNumber(existing: (string | null | undefined)[]): string {
  return formatBagNumber(getHighestBagNumber(existing) + 1);
}
