import { describe, expect, it } from "vitest"

import { buildGlobePins, countMappableHotels } from "./globe"
import { makeSummaries } from "@/test/fixtures"

const CHICAGO = { lat: 41.8755616, lng: -87.6244212 }
const AUSTIN = { lat: 30.2711286, lng: -97.7436995 }

describe("buildGlobePins", () => {
  it("gives a lone hotel its own pin, linked to its detail page", () => {
    const pins = buildGlobePins(
      makeSummaries({
        id: "hotel-01",
        name: "The Grand Luminary",
        coordinates: CHICAGO,
      })
    )

    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({
      lat: CHICAGO.lat,
      lng: CHICAGO.lng,
      label: "The Grand Luminary, Chicago, USA",
      href: "/hotel/hotel-01",
    })
  })

  it("groups hotels that share a coordinate into one pin", () => {
    const pins = buildGlobePins(
      makeSummaries(
        { id: "hotel-01", city: "Chicago", coordinates: CHICAGO },
        { id: "hotel-02", city: "Chicago", coordinates: CHICAGO },
        { id: "hotel-03", city: "Chicago", coordinates: CHICAGO }
      )
    )

    expect(pins).toHaveLength(1)
    expect(pins[0].hotels).toHaveLength(3)
    expect(pins[0].label).toBe("Chicago, USA · 3 hotels")
  })

  it("sends a clustered pin to the city route rather than one arbitrary hotel", () => {
    const pins = buildGlobePins(
      makeSummaries(
        { id: "hotel-01", city: "Chicago", state: "IL", coordinates: CHICAGO },
        { id: "hotel-02", city: "Chicago", state: "IL", coordinates: CHICAGO }
      )
    )

    expect(pins[0].href).toBe("/usa/il/chicago")
  })

  it("keeps distinct coordinates as separate pins", () => {
    const pins = buildGlobePins(
      makeSummaries(
        { id: "hotel-01", city: "Chicago", coordinates: CHICAGO },
        { id: "hotel-05", city: "Austin", state: "TX", coordinates: AUSTIN }
      )
    )

    expect(pins).toHaveLength(2)
    expect(pins.map((pin) => pin.lat).sort()).toEqual(
      [CHICAGO.lat, AUSTIN.lat].sort()
    )
  })

  it("skips hotels with no coordinates instead of dropping them at (0, 0)", () => {
    const pins = buildGlobePins(
      makeSummaries(
        { id: "hotel-01", coordinates: CHICAGO },
        { id: "hotel-02" },
        { id: "hotel-03" }
      )
    )

    expect(pins).toHaveLength(1)
    expect(pins[0].hotels.map((hotel) => hotel.id)).toEqual(["hotel-01"])
  })

  it("returns nothing when no hotel has been geocoded", () => {
    expect(buildGlobePins(makeSummaries({ id: "hotel-01" }))).toEqual([])
  })

  it("returns nothing for an empty list", () => {
    expect(buildGlobePins([])).toEqual([])
  })

  it("marks a pin fully booked only when every hotel on it is", () => {
    const mixed = buildGlobePins(
      makeSummaries(
        {
          id: "hotel-01",
          coordinates: CHICAGO,
          rooms: [{ room_id: "a", available_dates: [] }],
        },
        { id: "hotel-02", coordinates: CHICAGO }
      )
    )

    const soldOut = buildGlobePins(
      makeSummaries({
        id: "hotel-04",
        coordinates: CHICAGO,
        rooms: [{ room_id: "a", available_dates: [] }],
      })
    )

    expect(mixed[0].isFullyBooked).toBe(false)
    expect(soldOut[0].isFullyBooked).toBe(true)
  })

  it("treats coordinates within ~11m of each other as the same place", () => {
    const pins = buildGlobePins(
      makeSummaries(
        { id: "hotel-01", coordinates: { lat: 41.87556, lng: -87.62442 } },
        { id: "hotel-02", coordinates: { lat: 41.875561, lng: -87.624421 } }
      )
    )

    expect(pins).toHaveLength(1)
  })
})

describe("countMappableHotels", () => {
  it("counts only the geocoded hotels", () => {
    const hotels = makeSummaries(
      { id: "hotel-01", coordinates: CHICAGO },
      { id: "hotel-02", coordinates: AUSTIN },
      { id: "hotel-03" }
    )

    expect(countMappableHotels(hotels)).toBe(2)
  })
})
