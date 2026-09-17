import { describe, expect, it } from "vitest"

import {
  applyFilters,
  countActiveFilters,
  defaultFilters,
  getPriceBounds,
  parseFilters,
  serializeFilters,
} from "./filters"
import { normalizeHotels } from "./normalize"
import { toHotelSummaries, type HotelSummary } from "./summary"

function hotel(overrides: {
  id: string
  name?: string
  city?: string
  star_rating?: number
  overall_rating?: number
  review_count?: number
  price?: number
}): unknown {
  return {
    id: overrides.id,
    name: overrides.name ?? "Hotel",
    description: "A place to sleep.",
    star_rating: overrides.star_rating ?? 4,
    overall_rating: overrides.overall_rating ?? 4.5,
    review_count: overrides.review_count ?? 100,
    address: {
      street: "1 Main St",
      city: overrides.city ?? "Chicago",
      state: "IL",
      zip_code: "60611",
      country: "USA",
    },
    contact: { phone: "+1", email: "a@b.com" },
    amenities: [],
    policies: {
      check_in_time: "15:00",
      check_out_time: "11:00",
      cancellation: "Free",
    },
    rooms: [
      {
        room_id: `${overrides.id}-a`,
        type: "Standard",
        bed_type: "Queen",
        bed_count: 1,
        max_occupancy: 2,
        square_footage: 300,
        price_per_night: overrides.price ?? 200,
        room_amenities: [],
        available_dates: [],
      },
    ],
  }
}

const hotels: HotelSummary[] = toHotelSummaries(
  normalizeHotels([
    hotel({ id: "a", name: "Riverfront Inn", price: 100, star_rating: 3 }),
    hotel({
      id: "b",
      name: "Grand Luminary",
      price: 300,
      star_rating: 5,
      overall_rating: 4.9,
    }),
    hotel({ id: "c", name: "Austin Nest", city: "Austin", price: 200 }),
  ]).hotels
)

const bounds = getPriceBounds(hotels)

describe("getPriceBounds", () => {
  it("spans the cheapest and priciest entry point", () => {
    expect(bounds).toEqual({ min: 100, max: 300 })
  })

  it("falls back to a usable range for an empty scope", () => {
    expect(getPriceBounds([])).toEqual({ min: 0, max: 1000 })
  })
})

describe("parseFilters", () => {
  it("reads every supported param", () => {
    const filters = parseFilters(
      {
        q: " luminary ",
        city: "chicago,austin",
        stars: "4,5",
        minPrice: "150",
        maxPrice: "250",
        sort: "price-asc",
      },
      bounds
    )

    expect(filters).toEqual({
      query: "luminary",
      cities: ["chicago", "austin"],
      stars: [5, 4],
      price: { min: 150, max: 250 },
      sort: "price-asc",
    })
  })

  it("accepts repeated params as well as comma lists", () => {
    expect(parseFilters({ stars: ["4", "5"] }, bounds).stars).toEqual([5, 4])
  })

  it("ignores junk instead of throwing on a hand-edited URL", () => {
    const filters = parseFilters(
      { stars: "banana,9,0", minPrice: "abc", sort: "by-vibes" },
      bounds
    )

    expect(filters.stars).toEqual([])
    expect(filters.price).toEqual(bounds)
    expect(filters.sort).toBe("recommended")
  })

  it("clamps prices into the available range and orders them", () => {
    const filters = parseFilters({ minPrice: "900", maxPrice: "50" }, bounds)

    expect(filters.price).toEqual({ min: 100, max: 300 })
  })

  it("returns defaults for an empty query string", () => {
    expect(parseFilters({}, bounds)).toEqual(defaultFilters(bounds))
  })
})

describe("serializeFilters", () => {
  it("omits defaults so shared URLs stay short", () => {
    expect(serializeFilters(defaultFilters(bounds), bounds).toString()).toBe("")
  })

  it("round-trips through parseFilters", () => {
    const filters = {
      query: "inn",
      cities: ["chicago"],
      stars: [5, 3],
      price: { min: 120, max: 280 },
      sort: "rating-desc" as const,
    }

    const params = Object.fromEntries(serializeFilters(filters, bounds))

    expect(parseFilters(params, bounds)).toEqual(filters)
  })
})

describe("countActiveFilters", () => {
  it("counts nothing for untouched filters", () => {
    expect(countActiveFilters(defaultFilters(bounds), bounds)).toBe(0)
  })

  it("counts each narrowed dimension once", () => {
    expect(
      countActiveFilters(
        {
          ...defaultFilters(bounds),
          query: "inn",
          stars: [5],
          price: { min: 150, max: 300 },
        },
        bounds
      )
    ).toBe(3)
  })
})

describe("applyFilters", () => {
  it("returns everything when nothing is narrowed", () => {
    expect(applyFilters(hotels, defaultFilters(bounds))).toHaveLength(3)
  })

  it("matches the query against name and location", () => {
    const byName = applyFilters(hotels, {
      ...defaultFilters(bounds),
      query: "luminary",
    })
    const byCity = applyFilters(hotels, {
      ...defaultFilters(bounds),
      query: "austin",
    })

    expect(byName.map((entry) => entry.id)).toEqual(["b"])
    expect(byCity.map((entry) => entry.id)).toEqual(["c"])
  })

  it("is case-insensitive", () => {
    expect(
      applyFilters(hotels, { ...defaultFilters(bounds), query: "GRAND" })
    ).toHaveLength(1)
  })

  it("combines filters conjunctively", () => {
    const result = applyFilters(hotels, {
      ...defaultFilters(bounds),
      cities: ["chicago"],
      stars: [3],
    })

    expect(result.map((entry) => entry.id)).toEqual(["a"])
  })

  it("filters on the hotel's cheapest room, inclusively", () => {
    const result = applyFilters(hotels, {
      ...defaultFilters(bounds),
      price: { min: 100, max: 200 },
    })

    expect(result.map((entry) => entry.id).sort()).toEqual(["a", "c"])
  })

  it("returns an empty list when nothing matches", () => {
    expect(
      applyFilters(hotels, { ...defaultFilters(bounds), stars: [1] })
    ).toEqual([])
  })

  it("sorts by price ascending and descending", () => {
    expect(
      applyFilters(hotels, {
        ...defaultFilters(bounds),
        sort: "price-asc",
      }).map((entry) => entry.priceFrom)
    ).toEqual([100, 200, 300])

    expect(
      applyFilters(hotels, {
        ...defaultFilters(bounds),
        sort: "price-desc",
      }).map((entry) => entry.priceFrom)
    ).toEqual([300, 200, 100])
  })

  it("sorts recommended by guest rating first", () => {
    expect(
      applyFilters(hotels, defaultFilters(bounds)).map((entry) => entry.id)[0]
    ).toBe("b")
  })

  it("does not mutate the input list", () => {
    const original = [...hotels]
    applyFilters(hotels, { ...defaultFilters(bounds), sort: "price-desc" })

    expect(hotels).toEqual(original)
  })
})
