"use client"

import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import {
  defaultFilters,
  serializeFilters,
  type HotelFilters,
  type PriceBounds,
} from "@/domain/filters"

const URL_SYNC_DELAY_MS = 250

export type UseHotelFilters = {
  filters: HotelFilters
  setFilters: (update: Partial<HotelFilters>) => void
  reset: () => void
}

/**
 * Local filter state, mirrored to the URL on a debounce with `replace` so
 * dragging a slider doesn't fill the back button.
 *
 * Deliberately avoids `useSearchParams`, which would opt the page out of server
 * rendering. Instead it compares every incoming `initialFilters` (what the
 * server just parsed from the URL) against the query string this hook last
 * wrote itself. A mismatch means the URL changed from outside — back/forward,
 * a filtered link — and is adopted into local state. Its own debounced write
 * produces the query string it's already expecting, so typing never fights
 * itself. `ScopedDiscovery` still keys `HotelDiscovery` on the destination, so
 * navigating to a different scope gets a fresh instance regardless.
 */
export function useHotelFilters(
  initialFilters: HotelFilters,
  bounds: PriceBounds
): UseHotelFilters {
  const router = useRouter()
  const pathname = usePathname()

  const [filters, setFiltersState] =
    React.useState<HotelFilters>(initialFilters)

  const { min, max } = bounds
  const stableBounds = React.useMemo<PriceBounds>(
    () => ({ min, max }),
    [min, max]
  )

  // Starts at the server-rendered query string, so the first pass writes nothing.
  const lastWritten = React.useRef(
    serializeFilters(initialFilters, stableBounds).toString()
  )

  // Adopts a URL this hook didn't write itself. Its own debounced write (below)
  // echoes back here matching `lastWritten`, so this is a no-op while typing.
  React.useEffect(() => {
    const incoming = serializeFilters(initialFilters, stableBounds).toString()

    if (incoming === lastWritten.current) {
      return
    }

    lastWritten.current = incoming
    setFiltersState(initialFilters)
  }, [initialFilters, stableBounds])

  React.useEffect(() => {
    const next = serializeFilters(filters, stableBounds).toString()

    if (next === lastWritten.current) {
      return
    }

    const timer = setTimeout(() => {
      lastWritten.current = next
      React.startTransition(() => {
        router.replace(next ? `${pathname}?${next}` : pathname, {
          scroll: false,
        })
      })
    }, URL_SYNC_DELAY_MS)

    return () => clearTimeout(timer)
  }, [filters, stableBounds, pathname, router])

  const setFilters = React.useCallback((update: Partial<HotelFilters>) => {
    setFiltersState((current) => ({ ...current, ...update }))
  }, [])

  const reset = React.useCallback(() => {
    setFiltersState(defaultFilters(stableBounds))
  }, [stableBounds])

  return { filters, setFilters, reset }
}
