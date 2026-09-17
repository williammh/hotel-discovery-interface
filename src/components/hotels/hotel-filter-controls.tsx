"use client"

import {
  ArrowCounterClockwiseIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { LocationNode } from "@/domain/catalog"
import {
  SORT_OPTIONS,
  STAR_RATINGS,
  type HotelFilters,
  type PriceBounds,
  type SortOption,
} from "@/domain/filters"
import { formatCurrency } from "@/lib/format"

export type HotelFilterControlsProps = {
  filters: HotelFilters
  bounds: PriceBounds
  cities: readonly LocationNode[]
  activeFilterCount: number
  onChange: (update: Partial<HotelFilters>) => void
  onReset: () => void
}

/** Controlled, so the same form works in the desktop sidebar and the mobile sheet. */
export function HotelFilterControls({
  filters,
  bounds,
  cities,
  activeFilterCount,
  onChange,
  onReset,
}: HotelFilterControlsProps) {
  // A single-city scope (e.g. /usa/il/chicago) makes the city filter a no-op.
  const showCityFilter = cities.length > 1
  const priceIsFixed = bounds.min === bounds.max

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="hotel-search">Search</FieldLabel>
        <div className="relative">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="hotel-search"
            type="search"
            value={filters.query}
            placeholder="Hotel name, city, or country"
            className="ps-8"
            onChange={(event) => onChange({ query: event.target.value })}
          />
        </div>
      </Field>

      {showCityFilter && (
        <Field>
          <FieldLabel htmlFor="hotel-city">City</FieldLabel>
          <Select
            multiple
            value={filters.cities}
            onValueChange={(value: string[]) => onChange({ cities: value })}
          >
            <SelectTrigger id="hotel-city" className="w-full">
              <SelectValue>
                {(value: string[]) =>
                  value.length === 0
                    ? "All cities"
                    : value.length === 1
                      ? (cities.find((city) => city.slug === value[0])?.label ??
                        "1 city")
                      : `${value.length} cities`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.slug} value={city.slug}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{city.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {city.hotelCount}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field>
        <FieldLabel>Star rating</FieldLabel>
        <ToggleGroup
          // Base UI defaults to single-select; travellers expect 4 and 5 stars together.
          multiple
          aria-label="Filter by star rating"
          variant="outline"
          className="w-full"
          value={filters.stars.map(String)}
          onValueChange={(value: string[]) =>
            onChange({
              stars: value.map(Number).sort((a, b) => b - a),
            })
          }
        >
          {STAR_RATINGS.map((star) => (
            <ToggleGroupItem
              key={star}
              value={String(star)}
              aria-label={`${star} star`}
              className="flex-1"
            >
              {star}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel htmlFor="hotel-price">Price per night</FieldLabel>
        {priceIsFixed ? (
          <p className="text-xs text-muted-foreground">
            Every stay here starts at {formatCurrency(bounds.min)}.
          </p>
        ) : (
          <>
            <Slider
              id="hotel-price"
              aria-label="Price per night range"
              min={bounds.min}
              max={bounds.max}
              step={5}
              value={[filters.price.min, filters.price.max]}
              onValueChange={(value) => {
                const [min, max] = value as number[]
                onChange({ price: { min, max } })
              }}
            />
            <p className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{formatCurrency(filters.price.min)}</span>
              <span>{formatCurrency(filters.price.max)}</span>
            </p>
          </>
        )}
      </Field>

      <div className="flex items-center justify-between gap-2">
        <Select
          items={SORT_OPTIONS}
          value={filters.sort}
          onValueChange={(value: SortOption | null) =>
            value && onChange({ sort: value })
          }
        >
          <SelectTrigger size="sm" aria-label="Sort results">
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

        <Button
          variant="ghost"
          size="sm"
          disabled={activeFilterCount === 0}
          onClick={onReset}
        >
          <ArrowCounterClockwiseIcon aria-hidden="true" />
          Clear filters
          {activeFilterCount > 0 && ` (${activeFilterCount})`}
        </Button>
      </div>
    </div>
  )
}
