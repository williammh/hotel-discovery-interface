import { describe, expect, it } from "vitest"

import { getAllHotels } from "./catalog"
import { getCoordinateLookup, getHotelCoordinate } from "./coordinates"
import { buildGlobePins } from "./globe"
import { toHotelSummaries } from "./summary"

// Runs against the real cache, so it fails if the cache drifts from the seed.
describe("hotel coordinate cache", () => {
  it("covers every hotel in the catalogue", () => {
    const missing = getAllHotels()
      .filter((hotel) => hotel.coordinates === null)
      .map((hotel) => hotel.id)

    expect(missing).toEqual([])
  })

  it("only holds positions that exist on Earth", () => {
    for (const entry of Object.values(getCoordinateLookup())) {
      expect(entry.lat).toBeGreaterThanOrEqual(-90)
      expect(entry.lat).toBeLessThanOrEqual(90)
      expect(entry.lng).toBeGreaterThanOrEqual(-180)
      expect(entry.lng).toBeLessThanOrEqual(180)
    }
  })

  it("records that the fictional street addresses fell back to city centroids", () => {
    const precisions = new Set(
      Object.values(getCoordinateLookup()).map((entry) => entry.precision)
    )

    expect(precisions).toEqual(new Set(["city"]))
  })

  it("places a known hotel in the right city", () => {
    const chicago = getHotelCoordinate("hotel-01")

    expect(chicago?.lat).toBeCloseTo(41.87, 1)
    expect(chicago?.lng).toBeCloseTo(-87.62, 1)
    expect(chicago?.displayName).toContain("Chicago")
  })

  it("collapses the catalogue onto the 10 seeded travel hubs", () => {
    const pins = buildGlobePins(toHotelSummaries(getAllHotels()))

    expect(pins).toHaveLength(10)
    expect(pins.every((pin) => pin.hotels.length === 4)).toBe(true)
  })
})
