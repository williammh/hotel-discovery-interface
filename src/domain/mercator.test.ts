import { describe, expect, it } from "vitest"

import {
  clampCenter,
  fitView,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeLongitude,
  pointToScreen,
  project,
  TILE_SIZE,
  unproject,
  visibleTiles,
  worldSize,
  zoomAround,
} from "./mercator"

const CHICAGO = { lat: 41.8755616, lng: -87.6244212 }
const AUSTIN = { lat: 30.2711286, lng: -97.7436995 }
const TOKYO = { lat: 35.6768601, lng: 139.7638947 }

const WIDTH = 800
const HEIGHT = 600

describe("project", () => {
  it("puts the origin of the coordinate system at the middle of the world", () => {
    expect(project({ lat: 0, lng: 0 }, 0)).toEqual({ x: 128, y: 128 })
  })

  it("survives a round trip through unproject", () => {
    const projected = project(CHICAGO, 9)
    const restored = unproject(projected, 9)

    expect(restored.lat).toBeCloseTo(CHICAGO.lat, 9)
    expect(restored.lng).toBeCloseTo(CHICAGO.lng, 9)
  })

  it("clamps latitudes Mercator cannot represent instead of returning Infinity", () => {
    const { y } = project({ lat: 90, lng: 0 }, 2)

    expect(Number.isFinite(y)).toBe(true)
    expect(y).toBeCloseTo(0, 6)
  })
})

describe("normalizeLongitude", () => {
  it("wraps past the antimeridian", () => {
    expect(normalizeLongitude(190)).toBeCloseTo(-170, 9)
    expect(normalizeLongitude(-190)).toBeCloseTo(170, 9)
    expect(normalizeLongitude(-87.62)).toBeCloseTo(-87.62, 9)
  })
})

describe("fitView", () => {
  it("centres a lone point at a zoom where its city is legible", () => {
    const view = fitView([CHICAGO], WIDTH, HEIGHT)

    expect(view.center).toEqual(CHICAGO)
    expect(view.zoom).toBe(11)
  })

  it("keeps every point inside the viewport", () => {
    const points = [CHICAGO, AUSTIN, TOKYO]
    const view = fitView(points, WIDTH, HEIGHT)

    for (const point of points) {
      const { x, y } = pointToScreen(point, view, WIDTH, HEIGHT)

      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(WIDTH)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(HEIGHT)
    }
  })

  it("zooms closer for a tighter spread", () => {
    const wide = fitView([CHICAGO, TOKYO], WIDTH, HEIGHT)
    const narrow = fitView([CHICAGO, AUSTIN], WIDTH, HEIGHT)

    expect(narrow.zoom).toBeGreaterThan(wide.zoom)
  })

  it("falls back to the whole world when there is nothing to fit", () => {
    expect(fitView([], WIDTH, HEIGHT)).toEqual({
      center: { lat: 0, lng: 0 },
      zoom: MIN_ZOOM,
    })
  })
})

describe("zoomAround", () => {
  it("leaves the place under the pointer where it was", () => {
    const view = { center: CHICAGO, zoom: 6 }
    const anchor = { x: 200, y: 150 }

    const before = unproject(
      {
        x: project(view.center, view.zoom).x - WIDTH / 2 + anchor.x,
        y: project(view.center, view.zoom).y - HEIGHT / 2 + anchor.y,
      },
      view.zoom
    )

    const zoomed = zoomAround(view, view.zoom + 2, anchor, WIDTH, HEIGHT)
    const after = pointToScreen(before, zoomed, WIDTH, HEIGHT)

    expect(zoomed.zoom).toBe(8)
    expect(after.x).toBeCloseTo(anchor.x, 6)
    expect(after.y).toBeCloseTo(anchor.y, 6)
  })

  it("refuses to zoom past the tile server's limits", () => {
    const view = { center: CHICAGO, zoom: MAX_ZOOM }
    const anchor = { x: WIDTH / 2, y: HEIGHT / 2 }

    expect(zoomAround(view, MAX_ZOOM + 3, anchor, WIDTH, HEIGHT)).toBe(view)
    expect(
      zoomAround({ center: CHICAGO, zoom: MIN_ZOOM }, 0, anchor, WIDTH, HEIGHT)
        .zoom
    ).toBe(MIN_ZOOM)
  })
})

describe("clampCenter", () => {
  it("stops the viewport from panning off the top of the map", () => {
    const zoom = 3
    const center = clampCenter({ center: { lat: 85, lng: 0 }, zoom }, HEIGHT)

    expect(project(center, zoom).y).toBeCloseTo(HEIGHT / 2, 6)
  })

  it("centres vertically when the whole map is shorter than the viewport", () => {
    const zoom = 1
    const center = clampCenter({ center: { lat: 60, lng: 10 }, zoom }, HEIGHT)

    expect(project(center, zoom).y).toBeCloseTo(worldSize(zoom) / 2, 6)
    expect(center.lat).toBeCloseTo(0, 6)
  })
})

describe("visibleTiles", () => {
  it("covers the viewport", () => {
    const view = { center: CHICAGO, zoom: 5 }
    const tiles = visibleTiles(view, WIDTH, HEIGHT)

    expect(tiles.length).toBeGreaterThan(0)

    const left = Math.min(...tiles.map((tile) => tile.left))
    const right = Math.max(...tiles.map((tile) => tile.left + TILE_SIZE))
    const top = Math.min(...tiles.map((tile) => tile.top))
    const bottom = Math.max(...tiles.map((tile) => tile.top + TILE_SIZE))

    expect(left).toBeLessThanOrEqual(0)
    expect(right).toBeGreaterThanOrEqual(WIDTH)
    expect(top).toBeLessThanOrEqual(0)
    expect(bottom).toBeGreaterThanOrEqual(HEIGHT)
  })

  it("asks the tile server only for tiles that exist", () => {
    const tiles = visibleTiles(
      { center: { lat: 0, lng: 179 }, zoom: 2 },
      1600,
      400
    )

    for (const tile of tiles) {
      const [, z, x, y] = tile.url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/) ?? []

      expect(Number(z)).toBe(2)
      expect(Number(x)).toBeGreaterThanOrEqual(0)
      expect(Number(x)).toBeLessThan(4)
      expect(Number(y)).toBeGreaterThanOrEqual(0)
      expect(Number(y)).toBeLessThan(4)
    }
  })

  it("gives wrapped copies of a tile distinct keys", () => {
    const tiles = visibleTiles(
      { center: { lat: 0, lng: 179 }, zoom: 1 },
      1600,
      400
    )
    const keys = new Set(tiles.map((tile) => tile.key))

    expect(keys.size).toBe(tiles.length)
  })
})

describe("pointToScreen", () => {
  it("draws a pin in the copy of the world the viewport is looking at", () => {
    // Centre just east of the antimeridian; Tokyo sits west of it.
    const view = { center: { lat: 35, lng: -179 }, zoom: 3 }
    const { x } = pointToScreen(TOKYO, view, WIDTH, HEIGHT)

    expect(Math.abs(x - WIDTH / 2)).toBeLessThan(worldSize(view.zoom) / 2)
  })
})
