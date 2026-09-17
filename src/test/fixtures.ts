import type { CoordinateLookup } from "@/domain/coordinates"
import { normalizeHotels, type Hotel } from "@/domain/normalize"
import { toHotelSummaries, type HotelSummary } from "@/domain/summary"

type HotelOverrides = {
  id: string
  name?: string
  city?: string
  state?: string
  country?: string
  star_rating?: number
  overall_rating?: number
  review_count?: number
  amenities?: string[]
  rooms?: RoomOverrides[]
  /** Omit to get `coordinates: null`, as an ungeocoded hotel would have. */
  coordinates?: { lat: number; lng: number }
}

type RoomOverrides = {
  room_id: string
  type?: string
  price_per_night?: number
  available_dates?: string[]
  room_amenities?: string[]
}

function rawRoom(overrides: RoomOverrides) {
  return {
    room_id: overrides.room_id,
    type: overrides.type ?? "Standard Queen",
    bed_type: "Queen",
    bed_count: 1,
    max_occupancy: 2,
    square_footage: 320,
    price_per_night: overrides.price_per_night ?? 180,
    room_amenities: overrides.room_amenities ?? ["smart_tv"],
    available_dates: overrides.available_dates ?? [
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ],
  }
}

function rawHotel(overrides: HotelOverrides) {
  return {
    id: overrides.id,
    name: overrides.name ?? "Test Hotel",
    description: "A pleasant place to spend the night.",
    star_rating: overrides.star_rating ?? 4,
    overall_rating: overrides.overall_rating ?? 4.5,
    review_count: overrides.review_count ?? 250,
    address: {
      street: "1 Test Street",
      city: overrides.city ?? "Chicago",
      state: overrides.state ?? "IL",
      zip_code: "60611",
      country: overrides.country ?? "USA",
    },
    contact: { phone: "+1-312-555-0100", email: "stay@example.com" },
    amenities: overrides.amenities ?? ["pool", "free Wi-Fi"],
    policies: {
      check_in_time: "15:00",
      check_out_time: "11:00",
      cancellation: "Free cancellation up to 24 hours before check-in",
    },
    rooms: (overrides.rooms ?? [{ room_id: `${overrides.id}-a` }]).map(rawRoom),
  }
}

/** Builds normalised hotels through the real pipeline, so tests use real shapes. */
export function makeHotels(...overrides: HotelOverrides[]): Hotel[] {
  const coordinates: CoordinateLookup = Object.fromEntries(
    overrides
      .filter((entry) => entry.coordinates)
      .map((entry) => [
        entry.id,
        { ...entry.coordinates!, precision: "city" as const, displayName: "" },
      ])
  )

  return normalizeHotels(overrides.map(rawHotel), coordinates).hotels
}

export function makeSummaries(...overrides: HotelOverrides[]): HotelSummary[] {
  return toHotelSummaries(makeHotels(...overrides))
}
