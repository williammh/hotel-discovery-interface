import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { makeSummaries } from "@/test/fixtures"
import { HotelCard } from "./hotel-card"

const [hotel] = makeSummaries({
  id: "hotel-01",
  name: "The Grand Luminary",
  star_rating: 5,
  overall_rating: 4.8,
  review_count: 1240,
  amenities: ["pool", "free Wi-Fi", "fitness_center", "spa", "valet_parking"],
  rooms: [
    { room_id: "a", price_per_night: 299 },
    { room_id: "b", price_per_night: 199 },
  ],
})

describe("HotelCard", () => {
  it("links to the hotel's detail route", () => {
    render(<HotelCard hotel={hotel} />)

    expect(
      screen.getByRole("link", { name: "The Grand Luminary" })
    ).toHaveAttribute("href", "/hotel/hotel-01")
  })

  it("leads with the cheapest nightly rate", () => {
    render(<HotelCard hotel={hotel} />)

    expect(screen.getByText("$199")).toBeInTheDocument()
  })

  it("describes the star rating for assistive tech", () => {
    render(<HotelCard hotel={hotel} />)

    expect(screen.getByLabelText("5-star hotel")).toBeInTheDocument()
  })

  it("shows the guest score and review count once, in the footer", () => {
    render(<HotelCard hotel={hotel} />)

    expect(screen.getByText("4.8")).toBeInTheDocument()
    expect(screen.getByText("1.2K reviews")).toBeInTheDocument()
  })

  it("formats mixed-case amenity keys and collapses the overflow", () => {
    render(<HotelCard hotel={hotel} />)

    expect(screen.getByText("Free Wi-Fi")).toBeInTheDocument()
    expect(screen.getByText("Fitness Center")).toBeInTheDocument()
    expect(screen.getByText("+1 more")).toBeInTheDocument()
  })
})
