/** Adresse suisse découpée pour l'API Logtech */
export interface ParsedSwissAddress {
  street: string;
  streetNumber?: string;
  streetNumberSuffix?: string;
  zip?: string;
  city?: string;
  country: string;
  /** Texte original */
  raw: string;
}

/**
 * Découpe une adresse suisse en texte libre (ex. "Rue Example 42, 1200 Genève")
 * en champs structurés attendus par Logtech.
 */
export function parseSwissAddress(input: string): ParsedSwissAddress {
  const raw = input.trim();
  if (!raw) {
    return { street: 'Adresse inconnue', country: 'CH', raw };
  }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const streetPart = parts[0] ?? raw;
  const remainder = parts.slice(1).join(', ');

  let zip: string | undefined;
  let city: string | undefined;

  const zipCityMatch = remainder.match(/^(\d{4})\s+(.+)$/);
  if (zipCityMatch) {
    zip = zipCityMatch[1];
    city = zipCityMatch[2];
  } else {
    const inlineZipMatch = raw.match(/\b(\d{4})\s+([A-Za-zÀ-ÿ\s-]+)$/);
    if (inlineZipMatch) {
      zip = inlineZipMatch[1];
      city = inlineZipMatch[2]?.trim();
    }
  }

  const streetMatch = streetPart.match(/^(.+?)\s+(\d+)([a-zA-Z]?)$/);
  if (streetMatch) {
    return {
      street: streetMatch[1]!.trim(),
      streetNumber: streetMatch[2],
      streetNumberSuffix: streetMatch[3] || undefined,
      zip,
      city,
      country: 'CH',
      raw,
    };
  }

  return {
    street: streetPart,
    zip,
    city,
    country: 'CH',
    raw,
  };
}

/** Extrait L×l×h en cm depuis "30×20×15 cm" ou "30x20x15" */
export function parseDimensionsCm(
  dimensions: string | null | undefined,
): { length_cm?: number; width_cm?: number; height_cm?: number } {
  if (!dimensions?.trim()) return {};

  const match = dimensions.match(/(\d+)\s*[×xX*]\s*(\d+)\s*[×xX*]\s*(\d+)/);
  if (!match) return {};

  return {
    length_cm: Number(match[1]),
    width_cm: Number(match[2]),
    height_cm: Number(match[3]),
  };
}
