import {
  ClockIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  PhoneIcon,
  ProhibitIcon,
} from "@phosphor-icons/react/dist/ssr"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AmenityBadges } from "@/components/hotels/amenity-badges"
import { GuestRating } from "@/components/hotels/guest-rating"
import {
  LocationBreadcrumbs,
  scopeCrumbs,
} from "@/components/hotels/location-breadcrumbs"
import { RatingStars } from "@/components/hotels/rating-stars"
import { RoomAvailabilityChecker } from "@/components/hotels/room-availability-checker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { suggestStay } from "@/domain/availability"
import {
  getAllHotels,
  getCatalogAvailabilityWindow,
  getHotelById,
  resolveScope,
} from "@/domain/catalog"
import { formatAddress } from "@/lib/format"

type HotelParams = { id: string }

export function generateStaticParams(): HotelParams[] {
  return getAllHotels().map((hotel) => ({ id: hotel.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<HotelParams>
}): Promise<Metadata> {
  const hotel = getHotelById((await params).id)

  if (!hotel) {
    return { title: "Hotel not found" }
  }

  return {
    title: hotel.name,
    description: hotel.description,
  }
}

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<HotelParams>
}) {
  const hotel = getHotelById((await params).id)

  if (!hotel) {
    notFound()
  }

  const scope = resolveScope({
    country: hotel.slugs.country,
    state: hotel.slugs.state,
    city: hotel.slugs.city,
  })

  const availabilityWindow = getCatalogAvailabilityWindow()
  const suggested = suggestStay(hotel.rooms, availabilityWindow?.start ?? null)

  return (
    <article className="flex flex-col gap-6">
      <LocationBreadcrumbs
        crumbs={[
          ...scopeCrumbs(scope),
          { label: hotel.name, href: `/hotel/${hotel.id}` },
        ]}
      />

      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl font-medium text-balance sm:text-2xl">
            {hotel.name}
          </h1>
          <RatingStars rating={hotel.star_rating} size="md" />
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPinIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {formatAddress(hotel.address)}, {hotel.address.country}
          </span>
        </p>

        <p className="max-w-prose text-xs/relaxed">{hotel.description}</p>

        <GuestRating
          rating={hotel.overall_rating}
          reviewCount={hotel.review_count}
        />
      </header>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <section aria-labelledby="availability-heading" className="min-w-0">
          <h2
            id="availability-heading"
            className="mb-1 font-heading text-base font-medium"
          >
            Check availability
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Pick your check-in and check-out dates to see which of the{" "}
            {hotel.rooms.length} room{" "}
            {hotel.rooms.length === 1 ? "type" : "types"} are open and what they
            cost per night.
          </p>

          <RoomAvailabilityChecker
            rooms={hotel.rooms}
            suggestedStay={
              suggested
                ? { start: suggested.checkIn, end: suggested.checkOut }
                : null
            }
            availabilityWindow={availabilityWindow}
          />
        </section>

        <aside className="flex flex-col gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Amenities</CardTitle>
            </CardHeader>
            <CardContent>
              <AmenityBadges amenities={hotel.amenities} />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <ClockIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <dt className="text-muted-foreground">Check-in</dt>
                  <dd className="ms-auto tabular-nums">
                    {hotel.policies.check_in_time}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <ClockIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <dt className="text-muted-foreground">Check-out</dt>
                  <dd className="ms-auto tabular-nums">
                    {hotel.policies.check_out_time}
                  </dd>
                </div>
                <Separator className="my-1" />
                <div className="flex items-start gap-2">
                  <ProhibitIcon
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  />
                  <dt className="sr-only">Cancellation</dt>
                  <dd>{hotel.policies.cancellation}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-xs">
                <li className="flex items-center gap-2">
                  <PhoneIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <a
                    href={`tel:${hotel.contact.phone}`}
                    className="hover:underline"
                  >
                    {hotel.contact.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <EnvelopeSimpleIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <a
                    href={`mailto:${hotel.contact.email}`}
                    className="truncate hover:underline"
                  >
                    {hotel.contact.email}
                  </a>
                </li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </article>
  )
}
