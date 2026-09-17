"use client"

import {
  CornersOutIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react/dist/ssr"
import * as React from "react"

import type { GlobePin } from "@/domain/globe"
import {
  clampCenter,
  fitView,
  pointToScreen,
  TILE_SIZE,
  unproject,
  viewOrigin,
  visibleTiles,
  zoomAround,
  type MapView,
} from "@/domain/mercator"
import type { LatLng } from "@/domain/coordinates"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Past this many pixels a pointer gesture is a pan, not a click on a pin. */
const DRAG_THRESHOLD_PX = 4

/** Pins this far outside the viewport aren't rendered at all. */
const PIN_MARGIN_PX = 48

/** Accumulated wheel deltaY needed to spend one zoom level. */
const WHEEL_ZOOM_STEP_PX = 100

const PIN_COLORS = {
  available: "#f97316",
  fullyBooked: "#64748b",
} as const

type Size = { width: number; height: number }

export type HotelMapProps = {
  pins: GlobePin[]
  className?: string
  onPinHover?: (pin: GlobePin | null) => void
  onPinSelect?: (pin: GlobePin) => void
}

/**
 * The 2D stand-in for the globe: raster OpenStreetMap tiles positioned by hand.
 * Deliberately dependency-free — a map library would be a heavier fallback than
 * the thing it stands in for, and this only needs pan, zoom and pins.
 */
export function HotelMap({
  pins,
  className,
  onPinHover,
  onPinSelect,
}: HotelMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<Size | null>(null)
  const [view, setView] = React.useState<MapView | null>(null)

  const points = React.useMemo<LatLng[]>(
    () => pins.map((pin) => ({ lat: pin.lat, lng: pin.lng })),
    [pins]
  )

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return

    if (typeof ResizeObserver === "undefined") {
      setSize({ width: element.clientWidth, height: element.clientHeight })
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((current) =>
        current?.width === width && current.height === height
          ? current
          : { width, height }
      )
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Refits when the pin set changes (a filter edit), but not on a plain resize,
  // which would throw away wherever the reader had panned to.
  const fittedPoints = React.useRef<readonly LatLng[] | null>(null)

  React.useEffect(() => {
    if (!size || size.width === 0 || size.height === 0) return

    const alreadyFitted = fittedPoints.current === points
    fittedPoints.current = points

    setView((current) =>
      current && alreadyFitted
        ? current
        : fitView(points, size.width, size.height)
    )
  }, [points, size])

  const resetView = React.useCallback(() => {
    if (!size) return
    setView(fitView(points, size.width, size.height))
  }, [points, size])

  const zoomBy = React.useCallback((delta: number) => {
    const element = containerRef.current
    if (!element) return

    const { width, height } = element.getBoundingClientRect()

    setView((current) =>
      current
        ? zoomAround(
            current,
            current.zoom + delta,
            { x: width / 2, y: height / 2 },
            width,
            height
          )
        : current
    )
  }, [])

  // Native listener: React's onWheel is passive, so it can't stop the page from
  // scrolling underneath the zoom.
  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return

    // Trackpads fire many small wheel events per gesture where a mouse fires
    // one large one. Stepping zoom on every event would blow through the
    // whole range on a single trackpad scroll, so deltaY accumulates here and
    // only spends a zoom level once a gesture has scrolled enough.
    let accumulated = 0

    function handleWheel(event: WheelEvent) {
      if (!element) return
      event.preventDefault()

      accumulated += event.deltaY
      if (Math.abs(accumulated) < WHEEL_ZOOM_STEP_PX) return

      const delta = accumulated < 0 ? 1 : -1
      accumulated = 0

      const rect = element.getBoundingClientRect()
      const anchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      setView((current) =>
        current
          ? zoomAround(
              current,
              current.zoom + delta,
              anchor,
              rect.width,
              rect.height
            )
          : current
      )
    }

    element.addEventListener("wheel", handleWheel, { passive: false })
    return () => element.removeEventListener("wheel", handleWheel)
  }, [])

  const drag = React.useRef<{
    pointerId: number
    lastX: number
    lastY: number
    travelled: number
  } | null>(null)

  /** Set on pointerup, read by the click that follows it. */
  const panned = React.useRef(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return

    drag.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      travelled: 0,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId || !size) return

    const dx = event.clientX - current.lastX
    const dy = event.clientY - current.lastY
    if (dx === 0 && dy === 0) return

    current.lastX = event.clientX
    current.lastY = event.clientY
    current.travelled += Math.abs(dx) + Math.abs(dy)

    setView((previous) => {
      if (!previous) return previous

      const origin = viewOrigin(previous, size.width, size.height)
      const center = unproject(
        {
          x: origin.x - dx + size.width / 2,
          y: origin.y - dy + size.height / 2,
        },
        previous.zoom
      )

      return {
        zoom: previous.zoom,
        center: clampCenter({ center, zoom: previous.zoom }, size.height),
      }
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    // A pan that happens to end on a pin must not navigate.
    const travelled = drag.current.travelled
    drag.current = null
    panned.current = travelled > DRAG_THRESHOLD_PX
  }

  const selectPin = (pin: GlobePin) => {
    if (panned.current) {
      panned.current = false
      return
    }
    onPinSelect?.(pin)
  }

  const tiles = view && size ? visibleTiles(view, size.width, size.height) : []

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full touch-none overflow-hidden bg-muted select-none",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Tiles are printed for light backgrounds; this recolours them for dark. */}
      <div className="absolute inset-0 dark:brightness-[0.85] dark:hue-rotate-180 dark:invert">
        {tiles.map((tile) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            aria-hidden="true"
            width={TILE_SIZE}
            height={TILE_SIZE}
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              left: `${tile.left}px`,
              top: `${tile.top}px`,
              width: `${TILE_SIZE}px`,
              height: `${TILE_SIZE}px`,
            }}
          />
        ))}
      </div>

      {view &&
        size &&
        pins.map((pin) => {
          const { x, y } = pointToScreen(pin, view, size.width, size.height)

          const offscreen =
            x < -PIN_MARGIN_PX ||
            y < -PIN_MARGIN_PX ||
            x > size.width + PIN_MARGIN_PX ||
            y > size.height + PIN_MARGIN_PX

          if (offscreen) return null

          return (
            <div
              key={pin.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              <button
                type="button"
                className="relative block size-3.5 cursor-pointer rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                style={{
                  backgroundColor: pin.isFullyBooked
                    ? PIN_COLORS.fullyBooked
                    : PIN_COLORS.available,
                }}
                onClick={() => selectPin(pin)}
                onMouseEnter={() => onPinHover?.(pin)}
                onMouseLeave={() => onPinHover?.(null)}
                onFocus={() => onPinHover?.(pin)}
                onBlur={() => onPinHover?.(null)}
              >
                <span className="sr-only">{pin.label}</span>
              </button>
              {pin.priceFrom !== null && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-full ml-1 -translate-y-1/2 rounded-full bg-background/85 px-1.5 py-0.5 font-heading text-xs font-medium whitespace-nowrap text-foreground shadow-sm backdrop-blur-sm"
                >
                  From {formatCurrency(pin.priceFrom)}
                </span>
              )}
            </div>
          )
        })}

      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-1">
        <MapButton label="Zoom in" onClick={() => zoomBy(1)}>
          <PlusIcon aria-hidden="true" className="size-4" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(-1)}>
          <MinusIcon aria-hidden="true" className="size-4" />
        </MapButton>
        <MapButton label="Fit all locations" onClick={resetView}>
          <CornersOutIcon aria-hidden="true" className="size-4" />
        </MapButton>
      </div>
    </div>
  )
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Stops the pan gesture on the map underneath from starting.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className="flex size-7 items-center justify-center border bg-background/90 text-foreground backdrop-blur-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </button>
  )
}
