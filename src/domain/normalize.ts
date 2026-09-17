import { slugify } from "@/lib/slug"
import type { CoordinateLookup, LatLng } from "./coordinates"
import { hotelSchema, type RawHotel, type RawRoom } from "./hotel.schema"

export type Room = RawRoom

export type LocationSlugs = {
  country: string
  state: string
  city: string
}

export type Hotel = RawHotel & {
  slugs: LocationSlugs
  /** Cheapest room's nightly rate; `null` when a hotel has no rooms. */
  priceFrom: number | null
  hasAnyAvailability: boolean
  coordinates: LatLng | null
}

/** Surfaced rather than swallowed. */
export type DataIssue =
  | { kind: "invalid-record"; index: number; message: string }
  | { kind: "duplicate-hotel-id"; index: number; hotelId: string }
  | { kind: "duplicate-room-id"; hotelId: string; roomId: string }

export type NormalizedDataset = {
  hotels: Hotel[]
  issues: DataIssue[]
}

/** The seed repeats some `room_id`s; keeping both would double-count inventory. */
function dedupeRooms(
  hotelId: string,
  rooms: readonly Room[],
  issues: DataIssue[]
): Room[] {
  const seen = new Set<string>()

  return rooms.filter((room) => {
    if (seen.has(room.room_id)) {
      issues.push({ kind: "duplicate-room-id", hotelId, roomId: room.room_id })
      return false
    }
    seen.add(room.room_id)
    return true
  })
}

function toHotel(
  raw: RawHotel,
  issues: DataIssue[],
  coordinates: CoordinateLookup
): Hotel {
  const rooms = dedupeRooms(raw.id, raw.rooms, issues)
  const prices = rooms.map((room) => room.price_per_night)
  const position = coordinates[raw.id]

  return {
    ...raw,
    rooms,
    slugs: {
      country: slugify(raw.address.country),
      state: slugify(raw.address.state),
      city: slugify(raw.address.city),
    },
    priceFrom: prices.length > 0 ? Math.min(...prices) : null,
    hasAnyAvailability: rooms.some((room) => room.available_dates.length > 0),
    coordinates: position ? { lat: position.lat, lng: position.lng } : null,
  }
}

/**
 * Invalid records are dropped and reported so one bad row can't take down the
 * catalogue. `coordinates` is injected to keep this a pure function.
 */
export function normalizeHotels(
  input: unknown,
  coordinates: CoordinateLookup = {}
): NormalizedDataset {
  const issues: DataIssue[] = []

  if (!Array.isArray(input)) {
    return {
      hotels: [],
      issues: [
        {
          kind: "invalid-record",
          index: -1,
          message: "dataset is not an array",
        },
      ],
    }
  }

  const seenIds = new Set<string>()
  const hotels: Hotel[] = []

  input.forEach((record, index) => {
    const parsed = hotelSchema.safeParse(record)

    if (!parsed.success) {
      issues.push({
        kind: "invalid-record",
        index,
        message: parsed.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`
          )
          .join("; "),
      })
      return
    }

    if (seenIds.has(parsed.data.id)) {
      issues.push({
        kind: "duplicate-hotel-id",
        index,
        hotelId: parsed.data.id,
      })
      return
    }

    seenIds.add(parsed.data.id)
    hotels.push(toHotel(parsed.data, issues, coordinates))
  })

  return { hotels, issues }
}
