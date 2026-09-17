"use client"

import {
  GlobeHemisphereWestIcon,
  MapTrifoldIcon,
} from "@phosphor-icons/react/dist/ssr"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import * as React from "react"

import type { GlobeMarker } from "@/components/ui/3d-globe"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildGlobePins,
  countMappableHotels,
  GEOCODING_ATTRIBUTION,
  type GlobePin,
} from "@/domain/globe"
import type { HotelSummary } from "@/domain/summary"
import { cn } from "@/lib/utils"
import { isWebGLAvailable } from "@/lib/webgl"
import { HotelMap } from "./hotel-map"

// WebGL is browser-only. `ssr: false` is allowed because this is a Client Component.
const Globe3D = dynamic(
  () => import("@/components/ui/3d-globe").then((mod) => mod.Globe3D),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-full" />,
  }
)

const PIN_COLORS = {
  available: "#f97316",
  fullyBooked: "#64748b",
} as const

/**
 * `pending` covers the server render and hydration — the server can't know
 * whether WebGL works, and mounting the canvas to find out is what fails.
 */
type Renderer = "pending" | "globe" | "map"

/** What the reader asked for; `null` means "whatever this device can do". */
type ViewChoice = "globe" | "map" | null

const neverChanges = () => () => {}
const unknownOnTheServer = () => null

/** A device doesn't grow a GPU mid-session, so this store never emits. */
function useWebGLSupport(): boolean | null {
  return React.useSyncExternalStore<boolean | null>(
    neverChanges,
    isWebGLAvailable,
    unknownOnTheServer
  )
}

/** Inline SVG so pin heads need no network request. */
function pinImage(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${color}" stroke="white" stroke-width="2"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function toMarker(pin: GlobePin): GlobeMarker {
  return {
    lat: pin.lat,
    lng: pin.lng,
    label: pin.label,
    src: pinImage(
      pin.isFullyBooked ? PIN_COLORS.fullyBooked : PIN_COLORS.available
    ),
  }
}

export type HotelGlobeProps = {
  /** The filtered results, so narrowing the list narrows the globe. */
  hotels: HotelSummary[]
}

export function HotelGlobe({ hotels }: HotelGlobeProps) {
  const router = useRouter()
  const [hasInteracted, setHasInteracted] = React.useState(false)
  const [hovered, setHovered] = React.useState<GlobePin | null>(null)
  const [choice, setChoice] = React.useState<ViewChoice>(null)
  // Remounts the canvas, and with it the error boundary, on a manual retry.
  const [attempt, setAttempt] = React.useState(0)
  const [globeFailed, setGlobeFailed] = React.useState(false)

  const webglSupport = useWebGLSupport()

  const renderer: Renderer =
    choice === "map" || globeFailed
      ? "map"
      : choice === "globe"
        ? "globe"
        : webglSupport === null
          ? "pending"
          : webglSupport
            ? "globe"
            : "map"

  const globeUnavailable = globeFailed || webglSupport === false

  const pins = React.useMemo(() => buildGlobePins(hotels), [hotels])

  const markers = React.useMemo(() => pins.map(toMarker), [pins])

  const unmappedCount = hotels.length - countMappableHotels(hotels)

  // Markers carry no id, so they're matched back to their pin by position.
  const pinsByPosition = React.useMemo(() => {
    return new Map(pins.map((pin) => [`${pin.lat},${pin.lng}`, pin]))
  }, [pins])

  const findPin = React.useCallback(
    (marker: GlobeMarker | null) =>
      marker
        ? (pinsByPosition.get(`${marker.lat},${marker.lng}`) ?? null)
        : null,
    [pinsByPosition]
  )

  const config = React.useMemo(
    () => ({
      radius: 2,
      enablePan: true,
      enableZoom: true,
      minDistance: 2.6,
      maxDistance: 12,
      // Stops on first interaction: pins on a spinning globe can't be clicked.
      autoRotateSpeed: hasInteracted ? 0 : 0.35,
      showAtmosphere: true,
      atmosphereColor: "#4da6ff",
      atmosphereIntensity: 0.35,
    }),
    [hasInteracted]
  )

  const stopAutoRotate = React.useCallback(() => setHasInteracted(true), [])

  const openPin = React.useCallback(
    (pin: GlobePin) => router.push(pin.href),
    [router]
  )

  /**
   * Any WebGL failure lands here: no context at all, a context lost mid-session,
   * a driver crash, or the globe chunk failing to load. The map covers them all.
   */
  const fallBackToMap = React.useCallback((reason: unknown) => {
    console.warn(
      "[hotel-globe] 3D globe unavailable, showing the 2D map",
      reason
    )
    setHovered(null)
    setGlobeFailed(true)
  }, [])

  const showGlobe = React.useCallback(() => {
    setHovered(null)
    // A fresh attempt: the browser may well hand out a context this time.
    setGlobeFailed(false)
    setAttempt((current) => current + 1)
    setChoice("globe")
  }, [])

  const showMap = React.useCallback(() => {
    setHovered(null)
    setChoice("map")
  }, [])

  if (pins.length === 0) {
    return (
      <div className="flex h-[70svh] min-h-[28rem] flex-col items-center justify-center gap-2 border border-dashed p-6 text-center lg:h-full lg:min-h-0">
        <GlobeHemisphereWestIcon
          aria-hidden="true"
          className="size-5 text-muted-foreground"
        />
        <p className="font-heading text-sm font-medium">Nothing to map</p>
        <p className="max-w-[28ch] text-xs/relaxed text-muted-foreground">
          {hotels.length === 0
            ? "No properties match the current filters."
            : "These properties have no geocoded location yet. Run npm run geocode to place them."}
        </p>
      </div>
    )
  }

  return (
    <section
      aria-label="Hotel locations"
      className="relative h-[70svh] min-h-[28rem] overflow-hidden border bg-card lg:h-full lg:min-h-0"
      onPointerDown={stopAutoRotate}
      onWheel={stopAutoRotate}
    >
      {renderer === "pending" && <Skeleton className="h-full w-full" />}

      {renderer === "globe" && (
        <ErrorBoundary
          key={attempt}
          onError={fallBackToMap}
          fallback={<Skeleton className="h-full w-full" />}
        >
          <Globe3D
            markers={markers}
            config={config}
            className="h-full"
            onContextLost={fallBackToMap}
            onMarkerHover={(marker) => setHovered(findPin(marker))}
            onMarkerClick={(marker) => {
              const pin = findPin(marker)
              if (pin) {
                openPin(pin)
              }
            }}
          />
        </ErrorBoundary>
      )}

      {renderer === "map" && (
        <HotelMap pins={pins} onPinHover={setHovered} onPinSelect={openPin} />
      )}

      {/* Text summary of the canvas. Not a live region: hover changes would make it chatter. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <p className="bg-background/85 px-2 py-1 text-xs backdrop-blur-sm">
          {hovered ? (
            <span className="font-medium">{hovered.label}</span>
          ) : (
            <>
              <span className="font-medium tabular-nums">{hotels.length}</span>{" "}
              {hotels.length === 1 ? "property" : "properties"} across{" "}
              <span className="font-medium tabular-nums">{pins.length}</span>{" "}
              {pins.length === 1 ? "location" : "locations"}
              {unmappedCount > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {unmappedCount} unmapped
                </span>
              )}
            </>
          )}
        </p>

        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-1">
          <div
            role="group"
            aria-label="View"
            className="flex border bg-background/85 backdrop-blur-sm"
          >
            <ViewButton
              label="3D globe"
              active={renderer === "globe"}
              onClick={showGlobe}
            >
              <GlobeHemisphereWestIcon aria-hidden="true" className="size-4" />
            </ViewButton>
            <ViewButton
              label="2D map"
              active={renderer === "map"}
              onClick={showMap}
            >
              <MapTrifoldIcon aria-hidden="true" className="size-4" />
            </ViewButton>
          </div>

          {globeUnavailable && renderer === "map" && (
            <p className="bg-background/85 px-2 py-1 text-[0.65rem] text-muted-foreground backdrop-blur-sm">
              3D globe unavailable on this device
            </p>
          )}
        </div>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-3 text-[0.65rem] text-muted-foreground">
        <span className="bg-background/85 px-1.5 py-0.5 backdrop-blur-sm">
          {renderer === "map"
            ? "Drag to pan · scroll to zoom · click a pin to open"
            : "Drag to rotate · scroll to zoom · right-drag to pan"}
        </span>
        <span className="bg-background/85 px-1.5 py-0.5 backdrop-blur-sm">
          {renderer === "map" ? (
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
              className="pointer-events-auto underline underline-offset-2"
            >
              {GEOCODING_ATTRIBUTION}
            </a>
          ) : (
            GEOCODING_ATTRIBUTION
          )}
        </span>
      </p>
    </section>
  )
}

function ViewButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-7 cursor-pointer items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
