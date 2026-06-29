import { NextResponse } from 'next/server';
import { formatNominatimResult } from '@/lib/address-search';

/** Proxy vers Nominatim (OpenStreetMap) — recherche d'adresses en Suisse */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json([]);
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      countrycodes: 'ch',
      limit: '6',
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'Globus-Livraison/1.0 (contact@globus.ch)',
          Accept: 'application/json',
        },
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) {
      return NextResponse.json([]);
    }

    const data = (await response.json()) as {
      display_name: string;
      address?: Record<string, string>;
    }[];

    const suggestions = data.map(formatNominatimResult);
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json([]);
  }
}
