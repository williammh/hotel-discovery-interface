import {
  BedIcon,
  ProhibitIcon,
  RulerIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr"

import { AmenityBadges } from "@/components/hotels/amenity-badges"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { RoomAvailability } from "@/domain/availability"
import { formatCurrency, formatDateLabel, formatNights } from "@/lib/format"

function UnavailableReason({ nights }: { nights: readonly string[] }) {
  if (nights.length === 0) {
    return <span>Not open for the selected dates.</span>
  }

  const preview = nights.slice(0, 3).map(formatDateLabel).join(", ")
  const extra = nights.length - 3

  return (
    <span>
      Already booked on {preview}
      {extra > 0 && ` and ${extra} more ${extra === 1 ? "night" : "nights"}`}.
    </span>
  )
}

/** Unavailable rooms name their blocking nights rather than disappearing from the list. */
export function RoomCard({
  availability,
  nightCount,
}: {
  availability: RoomAvailability
  nightCount: number
}) {
  const { room, isAvailable, unavailableNights, totalPrice } = availability

  return (
    <Card
      size="sm"
      className={
        isAvailable ? "w-full" : "w-full bg-muted/40 text-muted-foreground"
      }
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h4 className="font-heading text-sm font-medium">{room.type}</h4>
          {isAvailable ? (
            <Badge variant="secondary">Available</Badge>
          ) : (
            <Badge variant="outline">
              <ProhibitIcon aria-hidden="true" />
              Unavailable
            </Badge>
          )}
        </div>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1">
            <BedIcon aria-hidden="true" className="size-3.5" />
            {room.bed_count} {room.bed_type}
            {room.bed_count === 1 ? " bed" : " beds"}
          </li>
          <li className="flex items-center gap-1">
            <UsersIcon aria-hidden="true" className="size-3.5" />
            Sleeps {room.max_occupancy}
          </li>
          <li className="flex items-center gap-1">
            <RulerIcon aria-hidden="true" className="size-3.5" />
            {room.square_footage} sq ft
          </li>
        </ul>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <AmenityBadges amenities={room.room_amenities} />

        <div className="flex flex-wrap items-end justify-between gap-2 border-t pt-3">
          <p className="text-xs">
            <span className="font-heading text-base font-medium text-foreground tabular-nums">
              {formatCurrency(room.price_per_night)}
            </span>{" "}
            <span className="text-muted-foreground">/ night</span>
          </p>

          {isAvailable && nightCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(totalPrice)}
              </span>{" "}
              total for {formatNights(nightCount)}
            </p>
          ) : (
            <p className="max-w-[24ch] text-end text-xs text-muted-foreground">
              <UnavailableReason nights={unavailableNights} />
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
