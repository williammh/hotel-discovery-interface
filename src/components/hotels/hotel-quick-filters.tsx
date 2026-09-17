"use client"

import {
  ArrowsDownUpIcon,
  CoinsIcon,
  FlowerLotusIcon,
  StarIcon,
  SwimmingPoolIcon,
} from "@phosphor-icons/react/dist/ssr"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import {
  SORT_OPTIONS,
  type HotelFilters,
  type PriceBounds,
  type SortOption,
} from "@/domain/filters"
import { formatCurrency } from "@/lib/format"

const RATING_PRESET = 4
const STAR_PRESET = [5, 4]

/** Nearest $25, so the chip reads like a price tag rather than a raw stat. */
function priceThreshold(bounds: PriceBounds): number {
  const raw = bounds.min + (bounds.max - bounds.min) * 0.75
  const rounded = Math.round(raw / 25) * 25
  return Math.min(bounds.max, Math.max(bounds.min + 25, rounded))
}

function sameStars(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && b.every((star) => a.includes(star))
}

export type HotelQuickFiltersProps = {
  filters: HotelFilters
  bounds: PriceBounds
  activeFilterCount: number
  onChange: (update: Partial<HotelFilters>) => void
  onReset: () => void
  /** The "All filters" trigger, rendered first — owned by the parent so it can control the sheet it opens. */
  allFiltersTrigger: React.ReactNode
}

/**
 * One-tap shortcuts for the filters travellers reach for most, mirroring the
 * reference screenshot's chip row. Everything here reads and writes the same
 * `HotelFilters` state as the full panel, so a chip and the panel never drift.
 */
export function HotelQuickFilters({
  filters,
  bounds,
  activeFilterCount,
  onChange,
  onReset,
  allFiltersTrigger,
}: HotelQuickFiltersProps) {
  const priceIsFixed = bounds.min === bounds.max
  const threshold = priceThreshold(bounds)
  const priceCapped =
    filters.price.min === bounds.min && filters.price.max === threshold

  const poolSelected = filters.amenities.includes("pool")
  const spaSelected = filters.amenities.includes("spa")
  const ratingSelected = filters.minRating === RATING_PRESET
  const starsSelected = sameStars(filters.stars, STAR_PRESET)

  function toggleAmenity(amenity: string, selected: boolean) {
    onChange({
      amenities: selected
        ? filters.amenities.filter((entry) => entry !== amenity)
        : [...filters.amenities, amenity],
    })
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Select
        items={SORT_OPTIONS}
        value={filters.sort}
        onValueChange={(value: SortOption | null) =>
          value && onChange({ sort: value })
        }
      >
        <SelectTrigger className="shrink-0" aria-label="Sort by">
          <ArrowsDownUpIcon aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {allFiltersTrigger}

      {!priceIsFixed && (
        <Toggle
          variant="outline"
          className="shrink-0"
          pressed={priceCapped}
          onPressedChange={(pressed) =>
            onChange({
              price: pressed
                ? { min: bounds.min, max: threshold }
                : { min: bounds.min, max: bounds.max },
            })
          }
        >
          <CoinsIcon aria-hidden="true" />
          Under {formatCurrency(threshold)}
        </Toggle>
      )}

      <Toggle
        variant="outline"
        className="shrink-0"
        pressed={poolSelected}
        onPressedChange={() => toggleAmenity("pool", poolSelected)}
      >
        <SwimmingPoolIcon aria-hidden="true" />
        Pool
      </Toggle>

      <Toggle
        variant="outline"
        className="shrink-0"
        pressed={spaSelected}
        onPressedChange={() => toggleAmenity("spa", spaSelected)}
      >
        <FlowerLotusIcon aria-hidden="true" />
        Spa
      </Toggle>

      <Toggle
        variant="outline"
        className="shrink-0"
        pressed={ratingSelected}
        onPressedChange={(pressed) =>
          onChange({ minRating: pressed ? RATING_PRESET : null })
        }
      >
        <StarIcon aria-hidden="true" />
        {RATING_PRESET}+ rating
      </Toggle>

      <Toggle
        variant="outline"
        className="shrink-0"
        pressed={starsSelected}
        onPressedChange={(pressed) =>
          onChange({ stars: pressed ? [...STAR_PRESET] : [] })
        }
      >
        4- or 5-star
      </Toggle>

      <Button
        variant="ghost"
        size="sm"
        disabled={activeFilterCount === 0}
        onClick={onReset}
        className="shrink-0"
      >
        Clear filters
        {activeFilterCount > 0 && ` (${activeFilterCount})`}
      </Button>
    </div>
  )
}
