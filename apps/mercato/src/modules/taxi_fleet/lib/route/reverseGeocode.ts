import { featureLabel, getOpenRouteServiceApiKey, orsGeocodeReverse, type RouteLocale } from './openRouteService'

async function reverseWithNominatim(lat: number, lng: number, lang: RouteLocale): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    'accept-language': lang === 'en' ? 'en' : 'pl',
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      'User-Agent': 'Open Mercato Taxi Fleet (RS Moto)',
      Accept: 'application/json',
    },
  })

  if (!res.ok) return null
  const data = (await res.json()) as { display_name?: string }
  return typeof data.display_name === 'string' ? data.display_name : null
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  locale: RouteLocale,
): Promise<{ address: string; source: 'ors' | 'nominatim' } | null> {
  if (getOpenRouteServiceApiKey()) {
    try {
      const data = await orsGeocodeReverse(lat, lng, locale)
      const address = data.features?.[0] ? featureLabel(data.features[0]) : null
      if (address) {
        return { address, source: 'ors' }
      }
    } catch {
      // fall through to Nominatim
    }
  }

  const nominatimAddress = await reverseWithNominatim(lat, lng, locale)
  if (nominatimAddress) {
    return { address: nominatimAddress, source: 'nominatim' }
  }

  return null
}
