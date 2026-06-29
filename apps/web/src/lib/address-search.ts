export interface AddressSuggestion {
  id: string;
  label: string;
  street?: string;
  city?: string;
  postcode?: string;
}

/** Formate une suggestion Nominatim en adresse lisible */
export function formatNominatimResult(item: {
  display_name: string;
  address?: Record<string, string>;
}): AddressSuggestion {
  const addr = item.address ?? {};
  const street = [addr.road, addr.house_number].filter(Boolean).join(' ');
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '';
  const postcode = addr.postcode ?? '';

  const parts = [street, [postcode, city].filter(Boolean).join(' ')].filter(Boolean);

  return {
    id: item.display_name,
    label: parts.length > 0 ? parts.join(', ') : item.display_name,
    street: street || undefined,
    city: city || undefined,
    postcode: postcode || undefined,
  };
}
