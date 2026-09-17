import type { LatLng } from "./coordinates"
import type { Hotel, Room } from "./normalize"

/**
 * What the dashboard sends to the browser. Carries `rooms` (not just
 * `roomCount`) so the discovery list can match stay dates and guest counts
 * against `room.available_dates`/`max_occupancy` the same way the single-hotel
 * detail page already does, via `domain/availability`.
 */
export type HotelSummary = {
  id: string
  name: string
  description: string
  star_rating: number
  overall_rating: number
  review_count: number
  address: {
    city: string
    state: string
    country: string
  }
  slugs: {
    country: string
    state: string
    city: string
  }
  amenities: string[]
  priceFrom: number | null
  hasAnyAvailability: boolean
  roomCount: number
  rooms: Room[]
  coordinates: LatLng | null
}

export function toHotelSummary(hotel: Hotel): HotelSummary {
  return {
    id: hotel.id,
    name: hotel.name,
    description: hotel.description,
    star_rating: hotel.star_rating,
    overall_rating: hotel.overall_rating,
    review_count: hotel.review_count,
    address: {
      city: hotel.address.city,
      state: hotel.address.state,
      country: hotel.address.country,
    },
    slugs: hotel.slugs,
    amenities: hotel.amenities,
    priceFrom: hotel.priceFrom,
    hasAnyAvailability: hotel.hasAnyAvailability,
    roomCount: hotel.rooms.length,
    rooms: hotel.rooms,
    coordinates: hotel.coordinates,
  }
}

export function toHotelSummaries(hotels: readonly Hotel[]): HotelSummary[] {
  return hotels.map(toHotelSummary)
}
