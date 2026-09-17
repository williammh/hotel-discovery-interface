"use client"

import {
  CompassIcon,
  MagnifyingGlassIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react/dist/ssr"
import * as React from "react"

import { HotelCard } from "@/components/hotels/hotel-card"
import { HotelFilterControls } from "@/components/hotels/hotel-filter-controls"
import { HotelGlobe } from "@/components/hotels/hotel-globe"
import { HotelQuickFilters } from "@/components/hotels/hotel-quick-filters"
import {
  HotelSearchBar,
  type AvailabilityWindow,
} from "@/components/hotels/hotel-search-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { LocationNode } from "@/domain/catalog"
import {
  applyFilters,
  countActiveFilters,
  type HotelFilters,
  type PriceBounds,
} from "@/domain/filters"
import type { HotelSummary } from "@/domain/summary"
import { useHotelFilters } from "@/hooks/use-hotel-filters"

export type HotelDiscoveryProps = {
  /** Every hotel in the current route scope, before filtering. */
  hotels: HotelSummary[]
  initialFilters: HotelFilters
  bounds: PriceBounds
  cities: LocationNode[]
  scopeLabel: string
  availabilityWindow: AvailabilityWindow
}

/**
 * The server renders the first filtered results; after hydration the same pure
 * filters run in the browser so typing is instant. On `lg` the dashboard fills
 * the viewport (`data-viewport-fill`) and only the results list scrolls.
 *
 * The search bar (query/dates/guests) and quick-filter chips sit above the
 * results, full width — everything else (city, granular star rating, guest
 * rating, amenities, exact price, sort) lives behind the "All filters" sheet.
 */
export function HotelDiscovery({
  hotels,
  initialFilters,
  bounds,
  cities,
  scopeLabel,
  availabilityWindow,
}: HotelDiscoveryProps) {
  const { filters, setFilters, reset } = useHotelFilters(initialFilters, bounds)

  const results = React.useMemo(
    () => applyFilters(hotels, filters),
    [hotels, filters]
  )

  const activeFilterCount = countActiveFilters(filters, bounds)

  const resultsRef = React.useRef<HTMLDivElement>(null)
  const globeRef = React.useRef<HTMLDivElement>(null)
  useForwardWheelToResults(resultsRef, globeRef)

  const [isFiltersOpen, setFiltersOpen] = React.useState(false)

  const allFiltersTrigger = (
    <Sheet open={isFiltersOpen} onOpenChange={setFiltersOpen}>
      <SheetTrigger
        render={<Button variant="outline" className="shrink-0" />}
      >
        <SlidersHorizontalIcon aria-hidden="true" />
        All filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary">{activeFilterCount}</Badge>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow the {hotels.length} properties in {scopeLabel}.
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <HotelFilterControls
            filters={filters}
            bounds={bounds}
            cities={cities}
            onChange={setFilters}
          />
        </div>
      </SheetContent>
    </Sheet>
  )

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <div className="flex flex-col gap-3">
        <HotelSearchBar
          filters={filters}
          availabilityWindow={availabilityWindow}
          onChange={setFilters}
        />
        <HotelQuickFilters
          filters={filters}
          bounds={bounds}
          activeFilterCount={activeFilterCount}
          onChange={setFilters}
          onReset={reset}
          allFiltersTrigger={allFiltersTrigger}
        />
      </div>

      <div
        data-viewport-fill
        className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_2fr] lg:grid-rows-[minmax(0,1fr)] lg:gap-8"
      >
        <section
          aria-label="Hotel results"
          className="flex min-w-0 flex-col gap-5 lg:min-h-0"
        >
          {/*
            Widened by the scrollbar's width and always scrollable, so the
            scrollbar sits in the column gap and cards align with the filters.
          */}
          <div
            ref={resultsRef}
            className="themed-scrollbar py-0.5 lg:min-h-0 lg:w-[calc(100%+var(--themed-scrollbar-w))] lg:flex-1 lg:overflow-y-scroll lg:overscroll-contain"
          >
            {results.length === 0 ? (
              <Empty className="border py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {hotels.length === 0 ? (
                      <CompassIcon aria-hidden="true" />
                    ) : (
                      <MagnifyingGlassIcon aria-hidden="true" />
                    )}
                  </EmptyMedia>
                  <EmptyTitle>
                    {hotels.length === 0
                      ? `No properties listed in ${scopeLabel}`
                      : "No hotels found matching criteria"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hotels.length === 0
                      ? "This destination has no properties in the catalogue yet."
                      : "Try widening the price range, clearing a star rating, or searching for a different name."}
                  </EmptyDescription>
                </EmptyHeader>
                {activeFilterCount > 0 && (
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={reset}>
                      Clear all filters
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <ul className="flex flex-col gap-4">
                {results.map((hotel) => (
                  <li key={hotel.id} className="flex">
                    <HotelCard hotel={hotel} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/*
          Hidden below `lg`: no room beside the list, and WebGL is the
          heaviest thing here. `isolate` gives the canvas its own stacking
          context — without it Chromium can composite the WebGL layer above
          the "All filters" sheet's backdrop-blurred overlay regardless of
          z-index.
        */}
        <div ref={globeRef} className="isolate hidden lg:block lg:min-h-0">
          <HotelGlobe hotels={results} />
        </div>
      </div>
    </div>
  )
}

const DESKTOP_QUERY = "(min-width: 64rem)"
const LINE_HEIGHT_PX = 16

function canScrollInDirection(from: Element | null, deltaY: number): boolean {
  for (let el = from; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY !== "auto" && overflowY !== "scroll") continue
    const canMove =
      deltaY < 0
        ? el.scrollTop > 0
        : el.scrollTop + el.clientHeight < el.scrollHeight - 1
    if (canMove) return true
  }
  return false
}

/** On desktop only the results list scrolls, so wheel events elsewhere are routed into it. */
function useForwardWheelToResults(
  resultsRef: React.RefObject<HTMLDivElement | null>,
  globeRef: React.RefObject<HTMLDivElement | null>
) {
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const desktop = window.matchMedia(DESKTOP_QUERY)

    function onWheel(event: WheelEvent) {
      const results = resultsRef.current
      if (!desktop.matches || !results || event.ctrlKey) return

      const target = event.target instanceof Element ? event.target : null
      // The globe zooms on wheel; open popovers and the list scroll natively.
      if (target && globeRef.current?.contains(target)) return
      if (canScrollInDirection(target, event.deltaY)) return

      const deltaY =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * LINE_HEIGHT_PX
          : event.deltaY
      results.scrollTop += deltaY
    }

    window.addEventListener("wheel", onWheel)
    return () => window.removeEventListener("wheel", onWheel)
  }, [resultsRef, globeRef])
}
