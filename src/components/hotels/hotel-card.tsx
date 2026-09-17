import Link from "next/link"

import { AmenityBadges } from "@/components/hotels/amenity-badges"
import { RatingStars } from "@/components/hotels/rating-stars"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { HotelSummary } from "@/domain/summary"
import { formatCount, formatCurrency } from "@/lib/format"

const AMENITY_PREVIEW_COUNT = 4

/** The title link stretches over the whole card for a usable touch target. */
export function HotelCard({ hotel }: { hotel: HotelSummary }) {
  const { city, state, country } = hotel.address

  return (
    <Card className="group/hotel relative transition-shadow focus-within:ring-2 focus-within:ring-ring hover:ring-foreground/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h3 className="font-heading text-sm font-medium text-balance">
            <Link
              href={`/hotel/${hotel.id}`}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {hotel.name}
            </Link>
          </h3>
          <RatingStars rating={hotel.star_rating} className="shrink-0" />
        </div>

        <p className="truncate text-xs text-muted-foreground">
          {city}, {state}, {country}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="line-clamp-1 text-xs/relaxed text-muted-foreground">
          {hotel.description}
        </p>

        <AmenityBadges
          amenities={hotel.amenities}
          limit={AMENITY_PREVIEW_COUNT}
        />

        <div className="mt-1 flex flex-wrap items-end justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {hotel.priceFrom === null ? (
              "Rates unavailable"
            ) : (
              <>
                <span className="font-heading text-base font-medium text-foreground tabular-nums">
                  {formatCurrency(hotel.priceFrom)}
                </span>{" "}
                / night
              </>
            )}
          </p>

          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {formatCount(hotel.review_count)} reviews
            </span>
            <span className="rounded-none bg-secondary px-1.5 py-0.5 font-heading text-xs font-medium text-secondary-foreground tabular-nums">
              {hotel.overall_rating.toFixed(1)}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
