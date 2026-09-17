import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { DestinationMenu } from "@/components/layout/destination-menu"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { getDestinations } from "@/domain/catalog"

export function SiteHeader() {
  const destinations = getDestinations()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-sm font-medium"
        >
          <BuildingsIcon aria-hidden="true" className="size-4" />
          Stayfinder
        </Link>

        <div className="ms-auto flex items-center gap-1">
          <DestinationMenu destinations={destinations} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
