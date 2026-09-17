import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { makeHotels } from "@/test/fixtures"
import { RoomAvailabilityChecker } from "./room-availability-checker"

const catalogueWindow = { start: "2026-07-10", end: "2026-07-14" }
const twoNights = { start: "2026-07-10", end: "2026-07-12" }

const [hotel] = makeHotels({
  id: "hotel-01",
  rooms: [
    {
      room_id: "room-01a",
      type: "Deluxe King Room",
      price_per_night: 299,
      available_dates: ["2026-07-10", "2026-07-11", "2026-07-12"],
    },
    {
      room_id: "room-01b",
      type: "Standard Queen",
      price_per_night: 199,
      available_dates: ["2026-07-10", "2026-07-11"],
    },
    {
      room_id: "room-01c",
      type: "Penthouse",
      price_per_night: 900,
      available_dates: ["2026-07-13"],
    },
  ],
})

function renderChecker(overrides = {}) {
  return render(
    <RoomAvailabilityChecker
      rooms={hotel.rooms}
      suggestedStay={twoNights}
      availabilityWindow={catalogueWindow}
      {...overrides}
    />
  )
}

function availableRoomNames(): string[] {
  return within(screen.getByRole("region", { name: "Available rooms" }))
    .getAllByRole("heading", { level: 4 })
    .map((heading) => heading.textContent ?? "")
}

describe("RoomAvailabilityChecker", () => {
  it("opens on a stay the hotel can fulfil", () => {
    renderChecker()

    expect(
      screen.getByRole("button", { name: /Jul 10, 2026 – Jul 12, 2026/ })
    ).toBeInTheDocument()
    expect(screen.getByText("2 nights")).toBeInTheDocument()
  })

  it("lists only the rooms open for every night, cheapest first", () => {
    renderChecker()

    expect(availableRoomNames()).toEqual(["Standard Queen", "Deluxe King Room"])
  })

  it("prices the stay, not just the nightly rate", () => {
    renderChecker()

    expect(screen.getByText("$199")).toBeInTheDocument()
    expect(screen.getByText("$398")).toBeInTheDocument()
    expect(screen.getByText("$598")).toBeInTheDocument()
  })

  it("explains why a room is unavailable rather than hiding it", () => {
    renderChecker()

    const unavailable = within(
      screen.getByRole("region", { name: "Unavailable rooms" })
    )

    expect(
      unavailable.getByRole("heading", { level: 4, name: "Penthouse" })
    ).toBeInTheDocument()
    expect(
      unavailable.getByText(/Already booked on Fri, Jul 10, Sat, Jul 11/)
    ).toBeInTheDocument()
  })

  it("shows the empty state when no room covers the stay", () => {
    renderChecker({
      rooms: hotel.rooms.filter((room) => room.room_id === "room-01c"),
    })

    expect(
      screen.getByText("No rooms available for these dates")
    ).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Available rooms" })).toBeNull()
  })

  it("handles a hotel that is fully booked", () => {
    const [soldOut] = makeHotels({
      id: "hotel-04",
      rooms: [{ room_id: "a", available_dates: [] }],
    })

    renderChecker({ rooms: soldOut.rooms })

    expect(
      screen.getByText("No rooms available for these dates")
    ).toBeInTheDocument()
  })

  it("asks for dates instead of guessing once they are cleared", async () => {
    const user = userEvent.setup()
    renderChecker()

    await user.click(screen.getByRole("button", { name: "Clear dates" }))

    expect(screen.getByText("Choose your stay")).toBeInTheDocument()
    expect(
      screen.getByText("Pick a check-out date to see which rooms are open.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Available rooms" })).toBeNull()
  })

  it("prompts for dates when the hotel has nothing to suggest", () => {
    renderChecker({ suggestedStay: null, availabilityWindow: null })

    expect(
      screen.getByRole("button", { name: /Select your dates/ })
    ).toBeInTheDocument()
    expect(screen.getByText("Choose your stay")).toBeInTheDocument()
  })

  it("tells the user which dates the catalogue actually covers", () => {
    renderChecker()

    expect(
      screen.getByText(/availability between Jul 10, 2026 and Jul 14, 2026/)
    ).toBeInTheDocument()
  })

  it("counts how many room types matched", () => {
    renderChecker()

    expect(screen.getByText(/of 3 room/)).toBeInTheDocument()
  })
})
