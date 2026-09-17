import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { defaultFilters, getPriceBounds } from "@/domain/filters"
import { makeSummaries } from "@/test/fixtures"
import { pathnameMock, routerMock } from "@/test/setup"
import { HotelDiscovery } from "./hotel-discovery"

const hotels = makeSummaries(
  {
    id: "hotel-01",
    name: "The Grand Luminary",
    city: "Chicago",
    star_rating: 5,
    overall_rating: 4.8,
    rooms: [{ room_id: "a", price_per_night: 299 }],
  },
  {
    id: "hotel-03",
    name: "Windy City Suites",
    city: "Chicago",
    star_rating: 3,
    overall_rating: 4.1,
    rooms: [{ room_id: "b", price_per_night: 135 }],
  },
  {
    id: "hotel-05",
    name: "Urban Nest Boutique",
    city: "Austin",
    state: "TX",
    star_rating: 4,
    overall_rating: 4.5,
    rooms: [{ room_id: "c", price_per_night: 145 }],
  }
)

const bounds = getPriceBounds(hotels)

const cities = [
  { slug: "austin", label: "Austin", hotelCount: 1 },
  { slug: "chicago", label: "Chicago", hotelCount: 2 },
]

function renderDashboard(overrides = {}) {
  return render(
    <HotelDiscovery
      hotels={hotels}
      initialFilters={defaultFilters(bounds)}
      bounds={bounds}
      cities={cities}
      scopeLabel="all destinations"
      {...overrides}
    />
  )
}

function resultNames(): string[] {
  return within(screen.getByRole("region", { name: "Hotel results" }))
    .getAllByRole("link")
    .map((link) => link.textContent ?? "")
}

describe("HotelDiscovery", () => {
  it("lists every hotel in scope before anything is filtered", () => {
    renderDashboard()

    expect(resultNames()).toEqual([
      "The Grand Luminary",
      "Urban Nest Boutique",
      "Windy City Suites",
    ])
  })

  it("narrows the list as the user types", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.type(screen.getByLabelText("Search"), "windy")

    expect(resultNames()).toEqual(["Windy City Suites"])
  })

  it("matches the search against the city as well as the name", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.type(screen.getByLabelText("Search"), "austin")

    expect(resultNames()).toEqual(["Urban Nest Boutique"])
  })

  it("filters by star rating", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole("button", { name: "5 star" }))

    expect(resultNames()).toEqual(["The Grand Luminary"])
  })

  it("combines star ratings additively", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole("button", { name: "5 star" }))
    await user.click(screen.getByRole("button", { name: "3 star" }))

    expect(resultNames()).toEqual(["The Grand Luminary", "Windy City Suites"])
  })

  it("shows the no-match empty state instead of a bare list", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.type(screen.getByLabelText("Search"), "not a real hotel")

    expect(
      screen.getByText("No hotels found matching criteria")
    ).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Luminary/ })).toBeNull()
  })

  it("restores every result from the empty state", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.type(screen.getByLabelText("Search"), "nothing")
    await user.click(screen.getByRole("button", { name: "Clear all filters" }))

    expect(resultNames()).toHaveLength(3)
  })

  it("distinguishes an empty scope from an over-filtered one", () => {
    renderDashboard({ hotels: [], cities: [], scopeLabel: "Atlantis" })

    expect(
      screen.getByText("No properties listed in Atlantis")
    ).toBeInTheDocument()
  })

  it("counts the active filters on the clear button", async () => {
    const user = userEvent.setup()
    renderDashboard()

    expect(screen.getByRole("button", { name: /Clear filters/ })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "4 star" }))
    await user.type(screen.getByLabelText("Search"), "nest")

    expect(
      screen.getByRole("button", { name: "Clear filters (2)" })
    ).toBeEnabled()
  })

  it("hides the city filter when the route already pins one city", () => {
    renderDashboard({
      cities: [{ slug: "chicago", label: "Chicago", hotelCount: 2 }],
    })

    expect(screen.queryByLabelText("City")).toBeNull()
  })

  it("offers the city filter when the scope spans several cities", () => {
    renderDashboard()

    expect(screen.getByLabelText("City")).toBeInTheDocument()
  })

  it("seeds the controls from filters parsed on the server", () => {
    renderDashboard({
      initialFilters: { ...defaultFilters(bounds), query: "windy" },
    })

    expect(screen.getByLabelText("Search")).toHaveValue("windy")
    expect(resultNames()).toEqual(["Windy City Suites"])
  })
})

describe("HotelDiscovery URL sync", () => {
  it("writes the active filters into the current route's query string", async () => {
    const user = userEvent.setup()
    pathnameMock.current = "/usa/il"
    renderDashboard()

    await user.click(screen.getByRole("button", { name: "5 star" }))

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith("/usa/il?stars=5", {
        scroll: false,
      })
    )
  })

  it("replaces rather than pushes, so filtering doesn't fill the back button", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole("button", { name: "4 star" }))

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled())
    expect(routerMock.push).not.toHaveBeenCalled()
  })

  it("strips the query string again when the filters are cleared", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole("button", { name: "4 star" }))
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled())

    await user.click(screen.getByRole("button", { name: /Clear filters/ }))

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenLastCalledWith("/", {
        scroll: false,
      })
    )
  })

  it("debounces typing into a single navigation", async () => {
    const user = userEvent.setup()
    renderDashboard()

    await user.type(screen.getByLabelText("Search"), "luminary")

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith("/?q=luminary", {
        scroll: false,
      })
    )
    expect(routerMock.replace).toHaveBeenCalledTimes(1)
  })
})
