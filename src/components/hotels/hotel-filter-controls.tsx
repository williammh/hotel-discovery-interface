"use client"

import { Field, FieldLabel } from "@/components/ui/field"
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
  MIN_RATING_OPTIONS,
  SORT_OPTIONS,
  STAR_RATINGS,
  type HotelFilters,
  type PriceBounds,
  type SortOption,
} from "@/domain/filters"
import { formatAmenity, formatCurrency } from "@/lib/format"

/** A curated subset of the seed's amenity strings, not every one it contains. */
const AMENITY_OPTIONS = [
  "pool",
  "spa",
  "free_breakfast",
  "fitness_center",
  "free Wi-Fi",
  "pet_friendly",
] as const

export type HotelFilterControlsProps = {
  filters: HotelFilters
  bounds: PriceBounds
  cities: readonly LocationNode[]
  onChange: (update: Partial<HotelFilters>) => void
}

/** Controlled, so the same form works wherever the "All filters" panel is rendered. */
export function HotelFilterControls({
  filters,
  bounds,
  cities,
  onChange,
}: HotelFilterControlsProps) {
  // A single-city scope (e.g. /usa/il/chicago) makes the city filter a no-op.
  const showCityFilter = cities.length > 1
  const priceIsFixed = bounds.min === bounds.max

  return (
    <div className="flex flex-col gap-5">
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
        <FieldLabel>Guest rating</FieldLabel>
        <ToggleGroup
          aria-label="Filter by minimum guest rating"
          variant="outline"
          className="w-full"
          value={filters.minRating !== null ? [String(filters.minRating)] : []}
          onValueChange={(value: string[]) =>
            onChange({ minRating: value[0] ? Number(value[0]) : null })
          }
        >
          {MIN_RATING_OPTIONS.map((rating) => (
            <ToggleGroupItem
              key={rating}
              value={String(rating)}
              aria-label={`${rating}+ guest rating`}
              className="flex-1"
            >
              {rating}+
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel>Amenities</FieldLabel>
        <ToggleGroup
          multiple
          aria-label="Filter by amenities"
          variant="outline"
          orientation="vertical"
          className="w-full"
          value={filters.amenities}
          onValueChange={(value: string[]) => onChange({ amenities: value })}
        >
          {AMENITY_OPTIONS.map((amenity) => (
            <ToggleGroupItem
              key={amenity}
              value={amenity}
              className="w-full justify-start"
            >
              {formatAmenity(amenity)}
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

      <Field>
        <FieldLabel htmlFor="hotel-sort">Sort by</FieldLabel>
        <Select
          items={SORT_OPTIONS}
          value={filters.sort}
          onValueChange={(value: SortOption | null) =>
            value && onChange({ sort: value })
          }
        >
          <SelectTrigger id="hotel-sort" size="sm" className="w-full">
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
      </Field>
    </div>
  )
}
