"use client"

import {
  CaretDownIcon,
  GlobeHemisphereWestIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Destination } from "@/domain/catalog"

/** Makes the location routes discoverable rather than URL-only. */
export function DestinationMenu({
  destinations,
}: {
  destinations: Destination[]
}) {
  const [isOpen, setOpen] = React.useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
        <GlobeHemisphereWestIcon aria-hidden="true" />
        Destinations
        <CaretDownIcon aria-hidden="true" className="size-3" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70svh] w-[min(92vw,28rem)] overflow-y-auto p-4"
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {destinations.map((country) => (
            <li key={country.slug}>
              <Link
                href={`/${country.slug}`}
                onClick={() => setOpen(false)}
                className="font-heading text-xs font-medium hover:underline"
              >
                {country.label}
                <span className="ms-1.5 text-muted-foreground tabular-nums">
                  {country.hotelCount}
                </span>
              </Link>

              <ul className="mt-1.5 flex flex-col gap-1">
                {country.states.flatMap((state) =>
                  state.cities.map((city) => (
                    <li key={`${state.slug}/${city.slug}`}>
                      <Link
                        href={`/${country.slug}/${state.slug}/${city.slug}`}
                        onClick={() => setOpen(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {city.label}
                        <span className="ms-1 opacity-60">· {state.label}</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
