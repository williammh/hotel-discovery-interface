import { CompassIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getDestinations } from "@/domain/catalog"

/** Lists real destinations so a dead end has somewhere to go. */
export default function NotFound() {
  const destinations = getDestinations()

  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CompassIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>We couldn&apos;t find that page</EmptyTitle>
        <EmptyDescription>
          That hotel or destination isn&apos;t in the catalogue. Try one of
          these instead.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {destinations.map((country) => (
            <li key={country.slug}>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/${country.slug}`} />}
              >
                {country.label}
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" render={<Link href="/" />}>
          Back to all hotels
        </Button>
      </EmptyContent>
    </Empty>
  )
}
