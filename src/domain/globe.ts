import type { HotelSummary } from "./summary"

/** ODbL attribution. Kept out of coordinates.ts so client code doesn't bundle the cache. */
export const GEOCODING_ATTRIBUTION = "© OpenStreetMap contributors"

/**
 * The seed's street addresses are fictional, so hotels geocode to city
 * centroids and would stack invisibly. Hotels sharing a position get one pin.
 */
export type GlobePin = {
  id: string
  lat: number
  lng: number
  hotels: HotelSummary[]
  label: string
  href: string
  isFullyBooked: boolean
}

/** ~11 m: groups identical centroids without merging genuinely distinct hotels. */
const POSITION_DECIMALS = 4

function positionKey(lat: number, lng: number): string {
  return `${lat.toFixed(POSITION_DECIMALS)},${lng.toFixed(POSITION_DECIMALS)}`
}

function pinLabel(hotels: readonly HotelSummary[]): string {
  const [first] = hotels
  const { city, country } = first.address

  if (hotels.length === 1) {
    return `${first.name}, ${city}, ${country}`
  }

  return `${city}, ${country} · ${hotels.length} hotels`
}

function pinHref(hotels: readonly HotelSummary[]): string {
  const [first] = hotels

  if (hotels.length === 1) {
    return `/hotel/${first.id}`
  }

  // A shared point is a city centroid: link the city rather than pick a hotel.
  const { country, state, city } = first.slugs
  return `/${country}/${state}/${city}`
}

/** Ungeocoded hotels are skipped; defaulting to (0, 0) would put them in the Atlantic. */
export function buildGlobePins(hotels: readonly HotelSummary[]): GlobePin[] {
  const groups = new Map<string, HotelSummary[]>()

  for (const hotel of hotels) {
    if (!hotel.coordinates) {
      continue
    }

    const key = positionKey(hotel.coordinates.lat, hotel.coordinates.lng)
    const existing = groups.get(key)

    if (existing) {
      existing.push(hotel)
    } else {
      groups.set(key, [hotel])
    }
  }

  return [...groups.entries()].map(([key, grouped]) => {
    // Non-null: every hotel in a group passed the coordinates check above.
    const { lat, lng } = grouped[0].coordinates!

    return {
      id: key,
      lat,
      lng,
      hotels: grouped,
      label: pinLabel(grouped),
      href: pinHref(grouped),
      isFullyBooked: grouped.every((hotel) => !hotel.hasAnyAvailability),
    }
  })
}

export function countMappableHotels(hotels: readonly HotelSummary[]): number {
  return hotels.filter((hotel) => hotel.coordinates !== null).length
}
