import { Badge } from "@/components/ui/badge"
import { getAmenityIcon } from "@/lib/amenity-icons"
import { formatAmenity } from "@/lib/format"

/** `limit` keeps a card with ten amenities the same height as one with three. */
export function AmenityBadges({
  amenities,
  limit,
}: {
  amenities: readonly string[]
  limit?: number
}) {
  if (amenities.length === 0) {
    return <p className="text-xs text-muted-foreground">No amenities listed.</p>
  }

  const shown = limit ? amenities.slice(0, limit) : amenities
  const hidden = amenities.length - shown.length

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {shown.map((amenity) => {
        const AmenityIcon = getAmenityIcon(amenity)
        return (
          <li key={amenity}>
            <Badge variant="outline">
              <AmenityIcon aria-hidden="true" />
              {formatAmenity(amenity)}
            </Badge>
          </li>
        )
      })}
      {hidden > 0 && (
        <li>
          <Badge variant="ghost" aria-label={`${hidden} more amenities`}>
            +{hidden} more
          </Badge>
        </li>
      )}
    </ul>
  )
}
