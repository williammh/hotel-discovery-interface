import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isValid,
  parseISO,
} from "date-fns"

import type { Hotel, Room } from "./normalize"

export const ISO_DATE_FORMAT = "yyyy-MM-dd"

/** Guard rail so a fat-fingered year can't ask for a million-night stay. */
export const MAX_STAY_NIGHTS = 30

export type StayRange = {
  checkIn: string
  /** Departure day; not itself a booked night. */
  checkOut: string
}

export type StayError =
  "incomplete" | "invalid-date" | "checkout-not-after-checkin" | "too-long"

export type StayValidation =
  | { status: "incomplete" }
  | { status: "invalid"; reason: StayError }
  | { status: "valid"; stay: StayRange; nights: string[] }

export function toIsoDate(date: Date): string {
  return format(date, ISO_DATE_FORMAT)
}

export function parseIsoDate(value: string): Date | null {
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

/** Half-open: in on the 10th, out on the 12th books the nights of the 10th and 11th. */
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const start = parseIsoDate(checkIn)
  const end = parseIsoDate(checkOut)

  if (!start || !end || differenceInCalendarDays(end, start) < 1) {
    return []
  }

  return eachDayOfInterval({ start, end }).slice(0, -1).map(toIsoDate)
}

export function validateStay(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
): StayValidation {
  if (!checkIn || !checkOut) {
    return { status: "incomplete" }
  }

  const start = parseIsoDate(checkIn)
  const end = parseIsoDate(checkOut)

  if (!start || !end) {
    return { status: "invalid", reason: "invalid-date" }
  }

  const nightCount = differenceInCalendarDays(end, start)

  if (nightCount < 1) {
    return { status: "invalid", reason: "checkout-not-after-checkin" }
  }

  if (nightCount > MAX_STAY_NIGHTS) {
    return { status: "invalid", reason: "too-long" }
  }

  return {
    status: "valid",
    stay: { checkIn, checkOut },
    nights: nightsBetween(checkIn, checkOut),
  }
}

export type RoomAvailability = {
  room: Room
  isAvailable: boolean
  /** Drives the "already booked on..." explanation. */
  unavailableNights: string[]
  totalPrice: number
}

/** Partial coverage counts as unavailable rather than silently shortening the stay. */
export function getRoomAvailability(
  room: Room,
  nights: readonly string[]
): RoomAvailability {
  const open = new Set(room.available_dates)
  const unavailableNights = nights.filter((night) => !open.has(night))

  return {
    room,
    isAvailable: nights.length > 0 && unavailableNights.length === 0,
    unavailableNights,
    totalPrice: room.price_per_night * nights.length,
  }
}

export type HotelAvailability = {
  nightCount: number
  available: RoomAvailability[]
  unavailable: RoomAvailability[]
}

export function getHotelAvailability(
  rooms: readonly Room[],
  nights: readonly string[]
): HotelAvailability {
  const results = rooms.map((room) => getRoomAvailability(room, nights))

  return {
    nightCount: nights.length,
    available: results
      .filter((result) => result.isAvailable)
      .sort((a, b) => a.room.price_per_night - b.room.price_per_night),
    unavailable: results.filter((result) => !result.isAvailable),
  }
}

/** Advertised in the UI so users don't pick dates the seed can never match. */
export function getAvailabilityWindow(
  hotels: readonly Hotel[]
): { start: string; end: string } | null {
  const dates = hotels
    .flatMap((hotel) => hotel.rooms)
    .flatMap((room) => room.available_dates)
    .sort()

  const start = dates.at(0)
  const end = dates.at(-1)

  return start && end ? { start, end } : null
}

export const DEFAULT_STAY_NIGHTS = 2

export function longestConsecutiveRun(dates: readonly string[]): string[] {
  const sorted = [...new Set(dates)].sort()
  let best: string[] = []
  let current: string[] = []

  for (const date of sorted) {
    const previous = current.at(-1)
    const isConsecutive =
      previous !== undefined &&
      differenceInCalendarDays(parseISO(date), parseISO(previous)) === 1

    current = isConsecutive ? [...current, date] : [date]

    if (current.length > best.length) {
      best = current
    }
  }

  return best
}

/**
 * The seed's dates are in the past, so "today" would show every hotel sold out.
 * Opens on a stay the hotel can fulfil, or the catalogue window if fully booked.
 */
export function suggestStay(
  rooms: readonly Room[],
  fallbackStart: string | null
): StayRange | null {
  const longest = rooms
    .map((room) => longestConsecutiveRun(room.available_dates))
    .reduce<string[]>(
      (best, run) => (run.length > best.length ? run : best),
      []
    )

  const start = longest.at(0) ?? fallbackStart

  if (!start) {
    return null
  }

  const parsedStart = parseIsoDate(start)

  if (!parsedStart) {
    return null
  }

  const nights = Math.max(
    1,
    Math.min(longest.length || DEFAULT_STAY_NIGHTS, DEFAULT_STAY_NIGHTS)
  )

  return { checkIn: start, checkOut: toIsoDate(addDays(parsedStart, nights)) }
}
