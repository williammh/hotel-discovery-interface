import { describe, expect, it } from "vitest"

import {
  getHotelAvailability,
  getRoomAvailability,
  longestConsecutiveRun,
  nightsBetween,
  suggestStay,
  validateStay,
} from "./availability"
import type { Room as NormalizedRoom } from "./normalize"

function room(overrides: Partial<NormalizedRoom> = {}): NormalizedRoom {
  return {
    room_id: "room-a",
    type: "Standard Queen",
    bed_type: "Queen",
    bed_count: 1,
    max_occupancy: 2,
    square_footage: 300,
    price_per_night: 100,
    room_amenities: [],
    available_dates: ["2026-07-10", "2026-07-11", "2026-07-12"],
    ...overrides,
  }
}

describe("nightsBetween", () => {
  it("treats the stay as half-open: check-out is not a booked night", () => {
    expect(nightsBetween("2026-07-10", "2026-07-12")).toEqual([
      "2026-07-10",
      "2026-07-11",
    ])
  })

  it("returns a single night for a one-night stay", () => {
    expect(nightsBetween("2026-07-10", "2026-07-11")).toEqual(["2026-07-10"])
  })

  it("spans month boundaries", () => {
    expect(nightsBetween("2026-07-31", "2026-08-02")).toEqual([
      "2026-07-31",
      "2026-08-01",
    ])
  })

  it("returns nothing when check-out is not after check-in", () => {
    expect(nightsBetween("2026-07-10", "2026-07-10")).toEqual([])
    expect(nightsBetween("2026-07-12", "2026-07-10")).toEqual([])
  })
})

describe("validateStay", () => {
  it("reports an incomplete range while only one date is chosen", () => {
    expect(validateStay("2026-07-10", null)).toEqual({ status: "incomplete" })
    expect(validateStay(null, null)).toEqual({ status: "incomplete" })
  })

  it("rejects an unparseable date", () => {
    expect(validateStay("not-a-date", "2026-07-12")).toEqual({
      status: "invalid",
      reason: "invalid-date",
    })
  })

  it("rejects a check-out on or before check-in", () => {
    expect(validateStay("2026-07-12", "2026-07-12")).toEqual({
      status: "invalid",
      reason: "checkout-not-after-checkin",
    })
    expect(validateStay("2026-07-12", "2026-07-10")).toEqual({
      status: "invalid",
      reason: "checkout-not-after-checkin",
    })
  })

  it("rejects an implausibly long stay", () => {
    expect(validateStay("2026-07-10", "2027-07-10")).toEqual({
      status: "invalid",
      reason: "too-long",
    })
  })

  it("returns the expanded nights for a valid stay", () => {
    expect(validateStay("2026-07-10", "2026-07-12")).toEqual({
      status: "valid",
      stay: { checkIn: "2026-07-10", checkOut: "2026-07-12" },
      nights: ["2026-07-10", "2026-07-11"],
    })
  })
})

describe("getRoomAvailability", () => {
  it("is available when every requested night is open", () => {
    const result = getRoomAvailability(room(), ["2026-07-10", "2026-07-11"])

    expect(result.isAvailable).toBe(true)
    expect(result.unavailableNights).toEqual([])
    expect(result.totalPrice).toBe(200)
  })

  it("is unavailable when only part of the stay is open", () => {
    const result = getRoomAvailability(room(), ["2026-07-12", "2026-07-13"])

    expect(result.isAvailable).toBe(false)
    expect(result.unavailableNights).toEqual(["2026-07-13"])
  })

  it("is unavailable when the room has no open nights at all", () => {
    const result = getRoomAvailability(room({ available_dates: [] }), [
      "2026-07-10",
    ])

    expect(result.isAvailable).toBe(false)
  })

  it("is unavailable for an empty stay rather than trivially true", () => {
    expect(getRoomAvailability(room(), []).isAvailable).toBe(false)
  })
})

describe("getHotelAvailability", () => {
  it("splits rooms and orders the available ones by price", () => {
    const rooms = [
      room({ room_id: "pricey", price_per_night: 400 }),
      room({ room_id: "booked", available_dates: [] }),
      room({ room_id: "cheap", price_per_night: 120 }),
    ]

    const result = getHotelAvailability(rooms, ["2026-07-10"])

    expect(result.available.map((entry) => entry.room.room_id)).toEqual([
      "cheap",
      "pricey",
    ])
    expect(result.unavailable.map((entry) => entry.room.room_id)).toEqual([
      "booked",
    ])
    expect(result.nightCount).toBe(1)
  })
})

describe("longestConsecutiveRun", () => {
  it("finds the longest unbroken stretch", () => {
    expect(
      longestConsecutiveRun([
        "2026-07-10",
        "2026-07-14",
        "2026-07-15",
        "2026-07-16",
      ])
    ).toEqual(["2026-07-14", "2026-07-15", "2026-07-16"])
  })

  it("handles unsorted and duplicated input", () => {
    expect(
      longestConsecutiveRun(["2026-07-11", "2026-07-10", "2026-07-11"])
    ).toEqual(["2026-07-10", "2026-07-11"])
  })

  it("returns nothing for an empty list", () => {
    expect(longestConsecutiveRun([])).toEqual([])
  })
})

describe("suggestStay", () => {
  it("opens on a stay the hotel can actually fulfil", () => {
    const stay = suggestStay([room()], "2026-01-01")

    expect(stay).toEqual({ checkIn: "2026-07-10", checkOut: "2026-07-12" })
    expect(
      getRoomAvailability(room(), nightsBetween(stay!.checkIn, stay!.checkOut))
        .isAvailable
    ).toBe(true)
  })

  it("shortens to a single night when that is all the room has", () => {
    const stay = suggestStay([room({ available_dates: ["2026-07-20"] })], null)

    expect(stay).toEqual({ checkIn: "2026-07-20", checkOut: "2026-07-21" })
  })

  it("falls back to the catalogue window for a fully booked hotel", () => {
    const stay = suggestStay([room({ available_dates: [] })], "2026-07-10")

    expect(stay).toEqual({ checkIn: "2026-07-10", checkOut: "2026-07-12" })
  })

  it("returns null when there is nothing to anchor on", () => {
    expect(suggestStay([], null)).toBeNull()
  })
})
