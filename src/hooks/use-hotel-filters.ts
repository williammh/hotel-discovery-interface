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
 * rendering. External URL changes remount the component (see `ScopedDiscovery`).
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
