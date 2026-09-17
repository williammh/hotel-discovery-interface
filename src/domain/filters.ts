import { z } from "zod"

import {
  getHotelAvailability,
  nightsBetween,
  validateStay,
  type StayRange,
} from "./availability"
import type { HotelSummary } from "./summary"

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating-desc", label: "Guest rating" },
  { value: "stars-desc", label: "Star rating" },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]["value"]

export const STAR_RATINGS = [5, 4, 3, 2, 1] as const

export const MIN_RATING_OPTIONS = [3, 3.5, 4, 4.5] as const

export const MIN_GUESTS = 1
export const MAX_GUESTS = 16

export type PriceBounds = { min: number; max: number }

export type { StayRange }

export type HotelFilters = {
  query: string
  /** City slugs; empty means "every city in the current route scope". */
  cities: string[]
  stars: number[]
  price: PriceBounds
  /** Raw amenity strings, matched against `HotelSummary.amenities`. */
  amenities: string[]
  minRating: number | null
  /** Null means no stay is selected, so availability isn't filtered on. */
  stay: StayRange | null
  guests: number
  sort: SortOption
}

/** Fallback bounds so an empty scope still renders a usable slider. */
export const FALLBACK_PRICE_BOUNDS: PriceBounds = { min: 0, max: 1000 }

export function getPriceBounds(hotels: readonly HotelSummary[]): PriceBounds {
  const prices = hotels
    .map((hotel) => hotel.priceFrom)
    .filter((price): price is number => price !== null)

  if (prices.length === 0) {
    return FALLBACK_PRICE_BOUNDS
  }

  return {
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
  }
}

export function defaultFilters(bounds: PriceBounds): HotelFilters {
  return {
    query: "",
    cities: [],
    stars: [],
    price: bounds,
    amenities: [],
    minRating: null,
    stay: null,
    guests: MIN_GUESTS,
    sort: "recommended",
  }
}

const listParam = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean)
  )

const singleParam = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? (value.at(0) ?? "") : value))

const searchParamsSchema = z.object({
  q: singleParam.optional(),
  city: listParam.optional(),
  stars: listParam.optional(),
  minPrice: singleParam.optional(),
  maxPrice: singleParam.optional(),
  amenities: listParam.optional(),
  minRating: singleParam.optional(),
  checkIn: singleParam.optional(),
  checkOut: singleParam.optional(),
  guests: singleParam.optional(),
  sort: singleParam.optional(),
})

export type RawSearchParams = Record<string, string | string[] | undefined>

function clamp(value: number, bounds: PriceBounds): number {
  return Math.min(Math.max(value, bounds.min), bounds.max)
}

function toPrice(
  value: string | undefined,
  fallback: number,
  bounds: PriceBounds
): number {
  if (value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? clamp(parsed, bounds) : fallback
}

/** User input: junk degrades per field to its default, so a hand-edited URL still renders. */
export function parseFilters(
  params: RawSearchParams,
  bounds: PriceBounds
): HotelFilters {
  const result = searchParamsSchema.safeParse(params)
  const defaults = defaultFilters(bounds)

  if (!result.success) {
    return defaults
  }

  const {
    q,
    city,
    stars,
    minPrice,
    maxPrice,
    amenities,
    minRating,
    checkIn,
    checkOut,
    guests,
    sort,
  } = result.data

  const parsedStars = (stars ?? [])
    .map(Number)
    .filter((star) => Number.isInteger(star) && star >= 1 && star <= 5)

  const low = toPrice(minPrice, bounds.min, bounds)
  const high = toPrice(maxPrice, bounds.max, bounds)

  const parsedAmenities = [
    ...new Set((amenities ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ]

  const parsedRating = Number(minRating)
  const rating =
    minRating !== undefined &&
    Number.isFinite(parsedRating) &&
    parsedRating >= 0 &&
    parsedRating <= 5
      ? parsedRating
      : null

  const stayValidation = validateStay(checkIn, checkOut)
  const stay = stayValidation.status === "valid" ? stayValidation.stay : null

  const parsedGuests = Number(guests)
  const guestCount =
    Number.isInteger(parsedGuests) &&
    parsedGuests >= MIN_GUESTS &&
    parsedGuests <= MAX_GUESTS
      ? parsedGuests
      : defaults.guests

  const sortOption = SORT_OPTIONS.find((option) => option.value === sort)

  return {
    query: q?.trim() ?? "",
    cities: city ?? [],
    stars: [...new Set(parsedStars)].sort((a, b) => b - a),
    price: { min: Math.min(low, high), max: Math.max(low, high) },
    amenities: parsedAmenities,
    minRating: rating,
    stay,
    guests: guestCount,
    sort: sortOption?.value ?? defaults.sort,
  }
}

/** Serialises filters, omitting defaults so shared URLs stay readable. */
export function serializeFilters(
  filters: HotelFilters,
  bounds: PriceBounds
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.query.trim()) {
    params.set("q", filters.query.trim())
  }
  if (filters.cities.length > 0) {
    params.set("city", filters.cities.join(","))
  }
  if (filters.stars.length > 0) {
    params.set("stars", [...filters.stars].sort((a, b) => b - a).join(","))
  }
  if (filters.price.min > bounds.min) {
    params.set("minPrice", String(filters.price.min))
  }
  if (filters.price.max < bounds.max) {
    params.set("maxPrice", String(filters.price.max))
  }
  if (filters.amenities.length > 0) {
    params.set("amenities", [...filters.amenities].sort().join(","))
  }
  if (filters.minRating !== null) {
    params.set("minRating", String(filters.minRating))
  }
  if (filters.stay) {
    params.set("checkIn", filters.stay.checkIn)
    params.set("checkOut", filters.stay.checkOut)
  }
  if (filters.guests > MIN_GUESTS) {
    params.set("guests", String(filters.guests))
  }
  if (filters.sort !== "recommended") {
    params.set("sort", filters.sort)
  }

  return params
}

export function countActiveFilters(
  filters: HotelFilters,
  bounds: PriceBounds
): number {
  return [
    filters.query.trim().length > 0,
    filters.cities.length > 0,
    filters.stars.length > 0,
    filters.price.min > bounds.min || filters.price.max < bounds.max,
    filters.amenities.length > 0,
    filters.minRating !== null,
    filters.stay !== null,
    filters.guests > MIN_GUESTS,
  ].filter(Boolean).length
}

function matchesQuery(hotel: HotelSummary, query: string): boolean {
  const needle = query.trim().toLowerCase()

  if (!needle) {
    return true
  }

  return [
    hotel.name,
    hotel.description,
    hotel.address.city,
    hotel.address.state,
    hotel.address.country,
  ].some((field) => field.toLowerCase().includes(needle))
}

function matchesPrice(hotel: HotelSummary, price: PriceBounds): boolean {
  if (hotel.priceFrom === null) {
    return false
  }
  return hotel.priceFrom >= price.min && hotel.priceFrom <= price.max
}

function matchesAmenities(hotel: HotelSummary, amenities: string[]): boolean {
  return amenities.every((amenity) => hotel.amenities.includes(amenity))
}

function matchesRating(hotel: HotelSummary, minRating: number | null): boolean {
  return minRating === null || hotel.overall_rating >= minRating
}

/**
 * With no stay picked, a guest count only asks "does any room type sleep
 * this many people at all". Once a stay is picked, it has to be a room
 * that's actually open for every night of it.
 */
function matchesStay(
  hotel: HotelSummary,
  stay: StayRange | null,
  guests: number
): boolean {
  if (!stay) {
    return hotel.rooms.some((room) => room.max_occupancy >= guests)
  }

  const nights = nightsBetween(stay.checkIn, stay.checkOut)
  if (nights.length === 0) {
    return true
  }

  return getHotelAvailability(hotel.rooms, nights).available.some(
    (entry) => entry.room.max_occupancy >= guests
  )
}

const comparators: Record<
  SortOption,
  (a: HotelSummary, b: HotelSummary) => number
> = {
  recommended: (a, b) =>
    b.overall_rating - a.overall_rating || b.review_count - a.review_count,
  "price-asc": (a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity),
  "price-desc": (a, b) =>
    (b.priceFrom ?? -Infinity) - (a.priceFrom ?? -Infinity),
  "rating-desc": (a, b) => b.overall_rating - a.overall_rating,
  "stars-desc": (a, b) =>
    b.star_rating - a.star_rating || b.overall_rating - a.overall_rating,
}

export function sortHotels(
  hotels: readonly HotelSummary[],
  sort: SortOption
): HotelSummary[] {
  return [...hotels].sort(comparators[sort])
}

export function applyFilters(
  hotels: readonly HotelSummary[],
  filters: HotelFilters
): HotelSummary[] {
  const matched = hotels.filter(
    (hotel) =>
      matchesQuery(hotel, filters.query) &&
      (filters.cities.length === 0 ||
        filters.cities.includes(hotel.slugs.city)) &&
      (filters.stars.length === 0 ||
        filters.stars.includes(hotel.star_rating)) &&
      matchesPrice(hotel, filters.price) &&
      matchesAmenities(hotel, filters.amenities) &&
      matchesRating(hotel, filters.minRating) &&
      matchesStay(hotel, filters.stay, filters.guests)
  )

  return sortHotels(matched, filters.sort)
}
