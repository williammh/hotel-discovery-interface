import { z } from "zod"

import cache from "@/data/hotel-coordinates.json"

/**
 * Positions come from a cache written offline by `npm run geocode`. Nominatim's
 * policy (1 req/s, no bulk querying) rules out geocoding at request time.
 */

/** `city` means the street address didn't resolve; true for the whole seed. */
export const COORDINATE_PRECISIONS = ["address", "city"] as const

export type CoordinatePrecision = (typeof COORDINATE_PRECISIONS)[number]

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.enum(COORDINATE_PRECISIONS),
  displayName: z.string(),
})

const cacheSchema = z.object({
  _meta: z
    .object({
      source: z.string(),
      license: z.string(),
      generatedAt: z.string(),
    })
    .partial()
    .optional(),
  hotels: z.record(z.string(), coordinateSchema),
})

export type HotelCoordinate = z.infer<typeof coordinateSchema>

export type LatLng = Pick<HotelCoordinate, "lat" | "lng">

export type CoordinateLookup = Record<string, HotelCoordinate>

/** A malformed cache degrades to no globe markers instead of breaking the catalogue. */
function loadCache(): CoordinateLookup {
  const parsed = cacheSchema.safeParse(cache)

  if (!parsed.success) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[coordinates] hotel-coordinates.json failed validation; " +
          "globe markers will be empty. Run `npm run geocode`.",
        parsed.error.issues
      )
    }
    return {}
  }

  return parsed.data.hotels
}

const coordinates = loadCache()

export function getCoordinateLookup(): CoordinateLookup {
  return coordinates
}

export function getHotelCoordinate(
  hotelId: string
): HotelCoordinate | undefined {
  return coordinates[hotelId]
}
