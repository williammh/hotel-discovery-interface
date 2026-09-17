import { HotelDiscovery } from "@/components/hotels/hotel-discovery"
import {
  LocationBreadcrumbs,
  scopeCrumbs,
} from "@/components/hotels/location-breadcrumbs"
import {
  getCitiesInScope,
  getHotelsInScope,
  type LocationScope,
} from "@/domain/catalog"
import {
  getPriceBounds,
  parseFilters,
  serializeFilters,
  type RawSearchParams,
} from "@/domain/filters"
import { toHotelSummaries } from "@/domain/summary"

export function scopeLabel(scope: LocationScope | null): string {
  if (!scope) {
    return "all destinations"
  }
  return scope.city?.label ?? scope.state?.label ?? scope.country.label
}

/**
 * Shared by every dashboard route. Filters are parsed and applied on the server
 * so a shared link arrives as real HTML, not a skeleton.
 */
export async function ScopedDiscovery({
  scope,
  searchParams,
  title,
  description,
}: {
  scope: LocationScope | null
  searchParams: Promise<RawSearchParams>
  title?: string
  description?: string
}) {
  const hotels = getHotelsInScope(scope)
  const summaries = toHotelSummaries(hotels)
  const bounds = getPriceBounds(summaries)
  const filters = parseFilters(await searchParams, bounds)
  console.log("REMOUNT");
  return (
    <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1">
      <LocationBreadcrumbs crumbs={scopeCrumbs(scope)} />

      {title && (
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-medium text-balance sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-prose text-xs/relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}

      {/*
        Keyed on the query string so back/forward re-seeds client state from
        the server. Typing writes the same key, so it never remounts.
      */}
      
      <HotelDiscovery
        key={serializeFilters(filters, bounds).toString()}
        hotels={summaries}
        initialFilters={filters}
        bounds={bounds}
        cities={getCitiesInScope(hotels)}
        scopeLabel={scopeLabel(scope)}
      />
    </div>
  )
}
