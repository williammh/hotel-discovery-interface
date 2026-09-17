import { describe, expect, it } from "vitest"

import { normalizeHotels } from "./normalize"

const baseRoom = {
  room_id: "room-a",
  type: "Standard Queen",
  bed_type: "Queen",
  bed_count: 1,
  max_occupancy: 2,
  square_footage: 300,
  price_per_night: 150,
  room_amenities: ["smart_tv"],
  available_dates: ["2026-07-10"],
}

const baseHotel = {
  id: "hotel-01",
  name: "Test Hotel",
  description: "A hotel.",
  star_rating: 4,
  overall_rating: 4.5,
  review_count: 100,
  address: {
    street: "1 Test St",
    city: "Île-de-France City",
    state: "Greater London",
    zip_code: "00000",
    country: "United Kingdom",
  },
  contact: { phone: "+1", email: "a@b.com" },
  amenities: ["pool"],
  policies: {
    check_in_time: "15:00",
    check_out_time: "11:00",
    cancellation: "Free",
  },
  rooms: [baseRoom],
}

describe("normalizeHotels", () => {
  it("derives URL-safe slugs from the address, stripping diacritics", () => {
    const { hotels } = normalizeHotels([baseHotel])

    expect(hotels[0].slugs).toEqual({
      country: "united-kingdom",
      state: "greater-london",
      city: "ile-de-france-city",
    })
  })

  it("reports the cheapest room as priceFrom", () => {
    const { hotels } = normalizeHotels([
      {
        ...baseHotel,
        rooms: [
          { ...baseRoom, room_id: "a", price_per_night: 220 },
          { ...baseRoom, room_id: "b", price_per_night: 180 },
        ],
      },
    ])

    expect(hotels[0].priceFrom).toBe(180)
  })

  it("drops repeated room ids and records the collision", () => {
    const { hotels, issues } = normalizeHotels([
      { ...baseHotel, rooms: [baseRoom, { ...baseRoom }] },
    ])

    expect(hotels[0].rooms).toHaveLength(1)
    expect(issues).toContainEqual({
      kind: "duplicate-room-id",
      hotelId: "hotel-01",
      roomId: "room-a",
    })
  })

  it("flags a hotel with no bookable night anywhere", () => {
    const { hotels } = normalizeHotels([
      { ...baseHotel, rooms: [{ ...baseRoom, available_dates: [] }] },
    ])

    expect(hotels[0].hasAnyAvailability).toBe(false)
  })

  it("keeps valid records when a sibling record is malformed", () => {
    const { hotels, issues } = normalizeHotels([
      { ...baseHotel, star_rating: 9 },
      { ...baseHotel, id: "hotel-02" },
    ])

    expect(hotels.map((hotel) => hotel.id)).toEqual(["hotel-02"])
    expect(issues[0]).toMatchObject({ kind: "invalid-record", index: 0 })
  })

  it("keeps only the first hotel for a repeated id", () => {
    const { hotels, issues } = normalizeHotels([
      baseHotel,
      { ...baseHotel, name: "Impostor" },
    ])

    expect(hotels).toHaveLength(1)
    expect(hotels[0].name).toBe("Test Hotel")
    expect(issues).toContainEqual({
      kind: "duplicate-hotel-id",
      index: 1,
      hotelId: "hotel-01",
    })
  })

  it("degrades to an empty catalogue when the seed is not an array", () => {
    const { hotels, issues } = normalizeHotels({ nope: true })

    expect(hotels).toEqual([])
    expect(issues).toHaveLength(1)
  })
})
