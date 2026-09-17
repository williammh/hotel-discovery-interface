import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ScopedDiscovery } from "@/components/hotels/scoped-discovery"
import { resolveScope } from "@/domain/catalog"
import type { RawSearchParams } from "@/domain/filters"

type CityParams = { country: string; state: string; city: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<CityParams>
}): Promise<Metadata> {
  const scope = resolveScope(await params)

  if (!scope?.city) {
    return { title: "Destination not found" }
  }

  return {
    title: `Hotels in ${scope.city.label}`,
    description: `${scope.city.hotelCount} properties in ${scope.city.label}, ${scope.country.label}.`,
  }
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<CityParams>
  searchParams: Promise<RawSearchParams>
}) {
  const scope = resolveScope(await params)

  if (!scope?.city) {
    notFound()
  }

  return (
    <ScopedDiscovery
      scope={scope}
      searchParams={searchParams}
      title={`Hotels in ${scope.city.label}`}
      description={`${scope.city.hotelCount} properties in ${scope.city.label}, ${scope.state?.label}, ${scope.country.label}.`}
    />
  )
}
