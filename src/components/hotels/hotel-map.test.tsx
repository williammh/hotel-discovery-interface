import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { buildGlobePins } from "@/domain/globe"
import { makeSummaries } from "@/test/fixtures"
import { stubViewport } from "@/test/viewport"
import { HotelMap } from "./hotel-map"

const CHICAGO = { lat: 41.8755616, lng: -87.6244212 }
const AUSTIN = { lat: 30.2711286, lng: -97.7436995 }

stubViewport()

function twoCityPins() {
  return buildGlobePins(
    makeSummaries(
      { id: "hotel-01", name: "The Grand Luminary", coordinates: CHICAGO },
      {
        id: "hotel-02",
        name: "Hotel Meridian",
        city: "Austin",
        state: "TX",
        coordinates: AUSTIN,
      }
    )
  )
}

function tileSources(container: HTMLElement): string[] {
  return [...container.querySelectorAll("img")].map((img) => img.src)
}

describe("HotelMap", () => {
  it("draws OpenStreetMap tiles", () => {
    const { container } = render(<HotelMap pins={twoCityPins()} />)

    const sources = tileSources(container)

    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(source).toMatch(
        /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/
      )
    }
  })

  it("gives every pin a labelled control", () => {
    render(<HotelMap pins={twoCityPins()} />)

    expect(
      screen.getByRole("button", {
        name: "The Grand Luminary, Chicago, USA",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Hotel Meridian, Austin, USA" })
    ).toBeInTheDocument()
  })

  it("reports the pin a reader picks", async () => {
    const user = userEvent.setup()
    const onPinSelect = vi.fn()

    render(<HotelMap pins={twoCityPins()} onPinSelect={onPinSelect} />)

    await user.click(
      screen.getByRole("button", { name: "The Grand Luminary, Chicago, USA" })
    )

    expect(onPinSelect).toHaveBeenCalledTimes(1)
    expect(onPinSelect.mock.calls[0][0]).toMatchObject({ lat: CHICAGO.lat })
  })

  it("reports hover, so the caption can name the location", async () => {
    const user = userEvent.setup()
    const onPinHover = vi.fn()

    render(<HotelMap pins={twoCityPins()} onPinHover={onPinHover} />)

    const pin = screen.getByRole("button", {
      name: "Hotel Meridian, Austin, USA",
    })

    await user.hover(pin)
    expect(onPinHover).toHaveBeenLastCalledWith(
      expect.objectContaining({ lat: AUSTIN.lat })
    )

    await user.unhover(pin)
    expect(onPinHover).toHaveBeenLastCalledWith(null)
  })

  it("asks for finer tiles after zooming in", async () => {
    const user = userEvent.setup()
    const { container } = render(<HotelMap pins={twoCityPins()} />)

    const zoomOf = (source: string) => Number(source.split("/")[3])
    const before = zoomOf(tileSources(container)[0])

    await user.click(screen.getByRole("button", { name: "Zoom in" }))

    expect(zoomOf(tileSources(container)[0])).toBe(before + 1)
  })
})
