/**
 * Validation du nombre de chiffres d'un numéro de téléphone.
 *
 * Le numéro est stocké au format « indicatif espace numéro », ex: "+41 79 123 45 67".
 * On vérifie que la partie nationale (sans l'indicatif) a le bon nombre de chiffres.
 * Pour les pays connus, on impose une longueur précise ; pour les autres, on
 * accepte une fourchette raisonnable afin de ne pas bloquer les numéros étrangers.
 */

// Nombre de chiffres attendus pour la partie nationale, par indicatif
const NATIONAL_LENGTHS: Record<string, number[]> = {
  '+41': [9], // Suisse  — ex: 79 123 45 67
  '+33': [9], // France  — ex: 6 12 34 56 78
  '+49': [10, 11], // Allemagne
  '+39': [9, 10], // Italie
  '+32': [8, 9], // Belgique
  '+44': [10], // Royaume-Uni
  '+1': [10], // États-Unis / Canada
  '+352': [9], // Luxembourg
};

// Fourchette générique pour les pays non listés
const GENERIC_MIN = 6;
const GENERIC_MAX = 14;

/**
 * Renvoie true si le numéro est vide (champ facultatif) ou s'il a un nombre
 * de chiffres valide pour l'indicatif choisi.
 */
export function isValidPhoneNumber(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return true; // champ facultatif : vide = OK

  const trimmed = value.trim();

  // On sépare l'indicatif (ex: "+41") du reste du numéro
  let code = '';
  let rest = trimmed;
  const spaceIndex = trimmed.indexOf(' ');
  if (trimmed.startsWith('+') && spaceIndex > 0) {
    code = trimmed.slice(0, spaceIndex);
    rest = trimmed.slice(spaceIndex + 1);
  }

  const digits = rest.replace(/\D/g, '');
  if (digits.length === 0) return false;

  const expected = NATIONAL_LENGTHS[code];
  if (expected) {
    return expected.includes(digits.length);
  }

  return digits.length >= GENERIC_MIN && digits.length <= GENERIC_MAX;
}
