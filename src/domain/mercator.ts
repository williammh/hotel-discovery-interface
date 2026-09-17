import type { LatLng } from "./coordinates"

/**
 * Web Mercator maths for the 2D fallback map. Pure functions over pixel
 * coordinates in the "world" plane: at zoom z the world is
 * `TILE_SIZE * 2 ** z` pixels square, with (0, 0) at the north-west corner.
 */

export const TILE_SIZE = 256
export const MIN_ZOOM = 1
export const MAX_ZOOM = 18

/** Mercator can't represent the poles; this is the standard cutoff. */
const MAX_LATITUDE = 85.05112878

/** A lone pin has no extent to fit, so it gets a city-level zoom instead. */
const SINGLE_POINT_ZOOM = 11

export type Point = { x: number; y: number }

export type MapView = {
  center: LatLng
  zoom: number
}

export type Tile = {
  /** Stable across wrapped copies, so React keys stay unique. */
  key: string
  url: string
  left: number
  top: number
}

export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)))
}

export function clampLatitude(lat: number): number {
  return Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, lat))
}

/** Wraps to [-180, 180) so panning past the antimeridian keeps sane values. */
export function normalizeLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

export function project({ lat, lng }: LatLng, zoom: number): Point {
  const size = worldSize(zoom)
  const sin = Math.sin((clampLatitude(lat) * Math.PI) / 180)

  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

export function unproject({ x, y }: Point, zoom: number): LatLng {
  const size = worldSize(zoom)
  const n = Math.PI * (1 - (2 * y) / size)

  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lng: (x / size) * 360 - 180,
  }
}

/** World pixel of the viewport's north-west corner. */
export function viewOrigin(
  { center, zoom }: MapView,
  width: number,
  height: number
): Point {
  const { x, y } = project(center, zoom)

  return { x: x - width / 2, y: y - height / 2 }
}

/**
 * Keeps the viewport inside the map vertically (horizontally the tiles wrap,
 * so longitude is free). Without this, panning north exposes empty space.
 */
export function clampCenter({ center, zoom }: MapView, height: number): LatLng {
  const size = worldSize(zoom)
  const { x, y } = project(center, zoom)
  const half = height / 2

  const clampedY =
    size <= height ? size / 2 : Math.min(Math.max(y, half), size - half)

  return {
    lat: unproject({ x, y: clampedY }, zoom).lat,
    lng: normalizeLongitude(center.lng),
  }
}

/** The view that shows every point, as tight as the viewport allows. */
export function fitView(
  points: readonly LatLng[],
  width: number,
  height: number,
  padding = 48
): MapView {
  if (points.length === 0) {
    return { center: { lat: 0, lng: 0 }, zoom: MIN_ZOOM }
  }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const point of points) {
    const lat = clampLatitude(point.lat)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, point.lng)
    maxLng = Math.max(maxLng, point.lng)
  }

  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  }

  if (points.length === 1) {
    return { center, zoom: SINGLE_POINT_ZOOM }
  }

  // Measured at zoom 0 and scaled, so one log2 gives the zoom that fits.
  const northWest = project({ lat: maxLat, lng: minLng }, 0)
  const southEast = project({ lat: minLat, lng: maxLng }, 0)

  const spanX = Math.max(southEast.x - northWest.x, Number.EPSILON)
  const spanY = Math.max(southEast.y - northWest.y, Number.EPSILON)

  const usableWidth = Math.max(width - padding * 2, TILE_SIZE / 2)
  const usableHeight = Math.max(height - padding * 2, TILE_SIZE / 2)

  const scale = Math.min(usableWidth / spanX, usableHeight / spanY)

  return { center, zoom: clampZoom(Math.floor(Math.log2(scale))) }
}

/**
 * Re-centres so `anchor` (a pixel offset inside the viewport) keeps pointing at
 * the same place after a zoom change — what wheel and double-click zoom expect.
 */
export function zoomAround(
  view: MapView,
  nextZoom: number,
  anchor: Point,
  width: number,
  height: number
): MapView {
  const zoom = clampZoom(nextZoom)

  if (zoom === view.zoom) {
    return view
  }

  const origin = viewOrigin(view, width, height)
  const target = unproject(
    { x: origin.x + anchor.x, y: origin.y + anchor.y },
    view.zoom
  )

  const projected = project(target, zoom)
  const center = unproject(
    {
      x: projected.x + (width / 2 - anchor.x),
      y: projected.y + (height / 2 - anchor.y),
    },
    zoom
  )

  return { center: clampCenter({ center, zoom }, height), zoom }
}

export function tileUrl(x: number, y: number, zoom: number): string {
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
}

/** The tiles covering the viewport, already positioned relative to its corner. */
export function visibleTiles(
  view: MapView,
  width: number,
  height: number
): Tile[] {
  const { zoom } = view
  const origin = viewOrigin(view, width, height)
  const count = 2 ** zoom

  const firstX = Math.floor(origin.x / TILE_SIZE)
  const lastX = Math.floor((origin.x + width) / TILE_SIZE)
  const firstY = Math.max(0, Math.floor(origin.y / TILE_SIZE))
  const lastY = Math.min(count - 1, Math.floor((origin.y + height) / TILE_SIZE))

  const tiles: Tile[] = []

  for (let y = firstY; y <= lastY; y++) {
    for (let x = firstX; x <= lastX; x++) {
      // East of the antimeridian the same tile repeats, under a different key.
      const wrappedX = ((x % count) + count) % count

      tiles.push({
        key: `${zoom}/${x}/${y}`,
        url: tileUrl(wrappedX, y, zoom),
        left: x * TILE_SIZE - origin.x,
        top: y * TILE_SIZE - origin.y,
      })
    }
  }

  return tiles
}

/**
 * Screen position of a point, in the copy of the world nearest the centre, so
 * a pin stays with its tiles when the map is panned across the antimeridian.
 */
export function pointToScreen(
  latLng: LatLng,
  view: MapView,
  width: number,
  height: number
): Point {
  const size = worldSize(view.zoom)
  const origin = viewOrigin(view, width, height)
  const { x, y } = project(latLng, view.zoom)

  const centerX = origin.x + width / 2
  const wraps = Math.round((centerX - x) / size)

  return { x: x + wraps * size - origin.x, y: y - origin.y }
}
