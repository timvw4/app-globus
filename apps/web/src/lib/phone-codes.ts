export interface PhoneCode {
  code: string;
  country: string;
}

/** Indicatifs épinglés en tête de liste */
export const PINNED_PHONE_CODES: PhoneCode[] = [
  { code: '+41', country: 'Suisse' },
  { code: '+33', country: 'France' },
];

/** Autres indicatifs courants (Europe & international) */
export const OTHER_PHONE_CODES: PhoneCode[] = [
  { code: '+49', country: 'Allemagne' },
  { code: '+43', country: 'Autriche' },
  { code: '+39', country: 'Italie' },
  { code: '+32', country: 'Belgique' },
  { code: '+352', country: 'Luxembourg' },
  { code: '+31', country: 'Pays-Bas' },
  { code: '+34', country: 'Espagne' },
  { code: '+351', country: 'Portugal' },
  { code: '+44', country: 'Royaume-Uni' },
  { code: '+1', country: 'États-Unis / Canada' },
  { code: '+48', country: 'Pologne' },
  { code: '+420', country: 'République tchèque' },
  { code: '+36', country: 'Hongrie' },
  { code: '+40', country: 'Roumanie' },
  { code: '+381', country: 'Serbie' },
  { code: '+385', country: 'Croatie' },
  { code: '+386', country: 'Slovénie' },
  { code: '+30', country: 'Grèce' },
  { code: '+45', country: 'Danemark' },
  { code: '+46', country: 'Suède' },
  { code: '+47', country: 'Norvège' },
  { code: '+358', country: 'Finlande' },
  { code: '+353', country: 'Irlande' },
  { code: '+7', country: 'Russie' },
  { code: '+90', country: 'Turquie' },
  { code: '+971', country: 'Émirats arabes unis' },
  { code: '+86', country: 'Chine' },
  { code: '+81', country: 'Japon' },
  { code: '+82', country: 'Corée du Sud' },
  { code: '+91', country: 'Inde' },
  { code: '+61', country: 'Australie' },
  { code: '+55', country: 'Brésil' },
  { code: '+52', country: 'Mexique' },
];

export const ALL_PHONE_CODES = [...PINNED_PHONE_CODES, ...OTHER_PHONE_CODES];

/** Extrait l'indicatif et le numéro local d'une valeur stockée */
export function parsePhoneNumber(value: string): { code: string; number: string } {
  if (!value?.trim()) {
    return { code: '+41', number: '' };
  }

  const normalized = value.trim();
  const codes = ALL_PHONE_CODES.map((c) => c.code).sort((a, b) => b.length - a.length);

  for (const code of codes) {
    if (normalized.startsWith(code)) {
      return {
        code,
        number: normalized.slice(code.length).replace(/^[\s-]+/, ''),
      };
    }
  }

  return { code: '+41', number: normalized };
}

/** Combine indicatif + numéro local */
export function formatPhoneNumber(code: string, number: string): string {
  const cleaned = number.replace(/[^\d\s]/g, '').trim();
  if (!cleaned) return '';
  return `${code} ${cleaned}`;
}
