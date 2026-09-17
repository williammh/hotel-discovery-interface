import { describe, expect, it } from "vitest"

import {
  getAllHotels,
  getCatalogAvailabilityWindow,
  getCitiesInScope,
  getDestinations,
  getHotelById,
  getHotelsInScope,
  resolveScope,
} from "./catalog"

// Runs against the real seed, so it doubles as a contract test for the dataset.
describe("catalog seed", () => {
  it("loads all 40 properties", () => {
    expect(getAllHotels()).toHaveLength(40)
  })

  it("covers 10 cities with 4 hotels each", () => {
    const cities = getCitiesInScope(getAllHotels())

    expect(cities).toHaveLength(10)
    expect(cities.every((city) => city.hotelCount === 4)).toBe(true)
  })

  it("marks 15% of the inventory as fully booked", () => {
    const soldOut = getAllHotels().filter((hotel) => !hotel.hasAnyAvailability)

    expect(soldOut).toHaveLength(6)
  })

  it("gives every hotel an entry-level price", () => {
    expect(
      getAllHotels().every((hotel) => typeof hotel.priceFrom === "number")
    ).toBe(true)
  })

  it("exposes the window the seed actually has availability for", () => {
    expect(getCatalogAvailabilityWindow()).toEqual({
      start: "2026-07-10",
      end: "2026-07-14",
    })
  })
})

describe("getHotelById", () => {
  it("finds a known hotel", () => {
    expect(getHotelById("hotel-01")?.name).toBe("The Grand Luminary")
  })

  it("returns undefined for an unknown id", () => {
    expect(getHotelById("hotel-999")).toBeUndefined()
  })
})

describe("resolveScope", () => {
  it("resolves a country", () => {
    const scope = resolveScope({ country: "usa" })

    expect(scope?.country.label).toBe("USA")
    expect(scope?.country.hotelCount).toBe(20)
    expect(scope?.state).toBeUndefined()
  })

  it("resolves a multi-word country slug", () => {
    expect(resolveScope({ country: "united-kingdom" })?.country.label).toBe(
      "United Kingdom"
    )
  })

  it("resolves a state within a country", () => {
    const scope = resolveScope({ country: "usa", state: "il" })

    expect(scope?.state?.label).toBe("IL")
    expect(scope?.city).toBeUndefined()
  })

  it("resolves a city within a state", () => {
    const scope = resolveScope({
      country: "usa",
      state: "il",
      city: "chicago",
    })

    expect(scope?.city?.label).toBe("Chicago")
    expect(scope?.city?.hotelCount).toBe(4)
  })

  it("resolves a state slug that had diacritics", () => {
    const scope = resolveScope({ country: "france", state: "ile-de-france" })

    expect(scope?.state?.label).toBe("Île-de-France")
  })

  it("tolerates percent-encoded and differently-cased segments", () => {
    expect(
      resolveScope({ country: "USA", state: "il", city: "Chicago" })?.city
        ?.label
    ).toBe("Chicago")
    expect(
      resolveScope({ country: "france", state: "%C3%8Ele-de-France" })?.state
        ?.label
    ).toBe("Île-de-France")
  })

  it("returns null for a place that does not exist", () => {
    expect(resolveScope({ country: "atlantis" })).toBeNull()
  })

  it("returns null when the state is real but not in that country", () => {
    expect(resolveScope({ country: "france", state: "il" })).toBeNull()
  })

  it("returns null when the city is real but not in that state", () => {
    expect(
      resolveScope({ country: "usa", state: "il", city: "austin" })
    ).toBeNull()
  })
})

describe("getHotelsInScope", () => {
  it("narrows to the country", () => {
    expect(getHotelsInScope(resolveScope({ country: "japan" }))).toHaveLength(4)
  })

  it("narrows to the state", () => {
    const hotels = getHotelsInScope(
      resolveScope({ country: "usa", state: "ny" })
    )

    expect(hotels).toHaveLength(4)
    expect(hotels.every((hotel) => hotel.address.state === "NY")).toBe(true)
  })

  it("narrows to the city", () => {
    const hotels = getHotelsInScope(
      resolveScope({ country: "usa", state: "tx", city: "austin" })
    )

    expect(hotels.every((hotel) => hotel.address.city === "Austin")).toBe(true)
  })

  it("falls back to the whole catalogue without a scope", () => {
    expect(getHotelsInScope(null)).toHaveLength(40)
  })
})

describe("getDestinations", () => {
  it("builds a country → state → city tree with counts", () => {
    const destinations = getDestinations()
    const usa = destinations.find((entry) => entry.slug === "usa")

    expect(destinations.map((entry) => entry.slug)).toContain("united-kingdom")
    expect(usa?.hotelCount).toBe(20)
    expect(usa?.states.map((state) => state.slug).sort()).toEqual([
      "fl",
      "il",
      "ny",
      "tx",
      "wa",
    ])
    expect(
      usa?.states.find((state) => state.slug === "il")?.cities[0]
    ).toMatchObject({ slug: "chicago", hotelCount: 4 })
  })
})
