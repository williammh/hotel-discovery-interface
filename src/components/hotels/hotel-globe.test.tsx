import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeSummaries } from "@/test/fixtures"
import { routerMock } from "@/test/setup"
import { stubViewport } from "@/test/viewport"
import { resetWebGLProbe } from "@/lib/webgl"
import { HotelGlobe } from "./hotel-globe"

const CHICAGO = { lat: 41.8755616, lng: -87.6244212 }

/** Swapped per test, since the globe is mocked before the module is imported. */
const globe = vi.hoisted(() => ({
  behaviour: "renders" as "renders" | "no-context" | "loses-context",
}))

// The real canvas needs WebGL, which jsdom doesn't have; this stands in for it
// so the failure modes can be triggered on purpose.
vi.mock("@/components/ui/3d-globe", async () => {
  const React = await import("react")

  return {
    Globe3D: ({
      onContextLost,
    }: {
      onContextLost?: (event: WebGLContextEvent) => void
    }) => {
      React.useEffect(() => {
        if (globe.behaviour === "loses-context") {
          onContextLost?.(new Event("webglcontextlost") as WebGLContextEvent)
        }
      }, [onContextLost])

      if (globe.behaviour === "no-context") {
        throw new Error("Error creating WebGL context")
      }

      return <div data-testid="globe-canvas" />
    },
  }
})

stubViewport()

function geocodedHotels() {
  return makeSummaries({
    id: "hotel-01",
    name: "The Grand Luminary",
    coordinates: CHICAGO,
  })
}

function tiles(container: HTMLElement) {
  return [...container.querySelectorAll("img")].filter((img) =>
    img.src.startsWith("https://tile.openstreetmap.org/")
  )
}

beforeEach(() => {
  globe.behaviour = "renders"
  // A caught render error still reaches console.error; keep the output readable.
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  resetWebGLProbe()
})

describe("HotelGlobe", () => {
  it("still renders the globe, with no pins, when the filters emptied the list", async () => {
    resetWebGLProbe(true)

    render(<HotelGlobe hotels={[]} />)

    expect(await screen.findByTestId("globe-canvas")).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Hotel locations" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Nothing to map")).toBeNull()
  })

  it("still renders the map, with no pins, when the filters emptied the list", async () => {
    resetWebGLProbe(false)

    const { container } = render(<HotelGlobe hotels={[]} />)

    await waitFor(() => expect(tiles(container).length).toBeGreaterThan(0))
    expect(screen.queryByText("Nothing to map")).toBeNull()
  })

  it("points at the geocoding script when hotels have no coordinates", () => {
    render(<HotelGlobe hotels={makeSummaries({ id: "hotel-01" })} />)

    expect(screen.getByText("Nothing to map")).toBeInTheDocument()
    expect(screen.getByText(/npm run geocode/)).toBeInTheDocument()
  })

  it("does not render the canvas region when there is nothing to plot", () => {
    render(<HotelGlobe hotels={makeSummaries({ id: "hotel-01" })} />)

    expect(screen.queryByRole("region", { name: "Hotel locations" })).toBeNull()
  })

  it("draws the map instead of the globe when WebGL is unavailable", async () => {
    resetWebGLProbe(false)

    const { container } = render(<HotelGlobe hotels={geocodedHotels()} />)

    await waitFor(() => expect(tiles(container).length).toBeGreaterThan(0))
    expect(
      screen.getByText("3D globe unavailable on this device")
    ).toBeInTheDocument()
    expect(screen.queryByTestId("globe-canvas")).toBeNull()
  })

  it("falls back to the map when the canvas fails to start", async () => {
    resetWebGLProbe(true)
    globe.behaviour = "no-context"

    const { container } = render(<HotelGlobe hotels={geocodedHotels()} />)

    await waitFor(() => expect(tiles(container).length).toBeGreaterThan(0))
    expect(
      screen.getByText("3D globe unavailable on this device")
    ).toBeInTheDocument()
  })

  it("falls back to the map when the GPU takes the context away", async () => {
    resetWebGLProbe(true)
    globe.behaviour = "loses-context"

    const { container } = render(<HotelGlobe hotels={geocodedHotels()} />)

    await waitFor(() => expect(tiles(container).length).toBeGreaterThan(0))
  })

  it("lets a reader switch between the globe and the map by hand", async () => {
    const user = userEvent.setup()
    resetWebGLProbe(true)

    const { container } = render(<HotelGlobe hotels={geocodedHotels()} />)

    expect(await screen.findByTestId("globe-canvas")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "2D map" }))

    await waitFor(() => expect(tiles(container).length).toBeGreaterThan(0))
    expect(screen.queryByTestId("globe-canvas")).toBeNull()
    // Chosen deliberately, so nothing claims the globe is broken.
    expect(screen.queryByText("3D globe unavailable on this device")).toBeNull()

    await user.click(screen.getByRole("button", { name: "3D globe" }))

    expect(await screen.findByTestId("globe-canvas")).toBeInTheDocument()
    expect(tiles(container)).toHaveLength(0)
  })

  it("marks the view in use as the pressed one", async () => {
    resetWebGLProbe(false)

    render(<HotelGlobe hotels={geocodedHotels()} />)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2D map" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    )
    expect(screen.getByRole("button", { name: "3D globe" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("opens a hotel from a map pin", async () => {
    const user = userEvent.setup()
    resetWebGLProbe(false)

    render(<HotelGlobe hotels={geocodedHotels()} />)

    const pin = await screen.findByRole("button", {
      name: "The Grand Luminary, Chicago, USA",
    })

    await user.click(pin)

    expect(routerMock.push).toHaveBeenCalledWith("/hotel/hotel-01")
  })

  it("credits OpenStreetMap for the tiles", async () => {
    resetWebGLProbe(false)

    render(<HotelGlobe hotels={geocodedHotels()} />)

    const credit = await screen.findByRole("link", {
      name: "© OpenStreetMap contributors",
    })

    expect(credit).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright"
    )
  })
})
