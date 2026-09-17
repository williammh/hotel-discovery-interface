import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ScopedDiscovery } from "@/components/hotels/scoped-discovery"
import { resolveScope } from "@/domain/catalog"
import type { RawSearchParams } from "@/domain/filters"

type CountryParams = { country: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<CountryParams>
}): Promise<Metadata> {
  const scope = resolveScope(await params)

  if (!scope) {
    return { title: "Destination not found" }
  }

  return {
    title: `Hotels in ${scope.country.label}`,
    description: `${scope.country.hotelCount} properties across ${scope.country.label}.`,
  }
}

export default async function CountryPage({
  params,
  searchParams,
}: {
  params: Promise<CountryParams>
  searchParams: Promise<RawSearchParams>
}) {
  const scope = resolveScope(await params)

  if (!scope) {
    notFound()
  }

  return (
    <ScopedDiscovery
      scope={scope}
      searchParams={searchParams}
      title={`Hotels in ${scope.country.label}`}
      description={`${scope.country.hotelCount} properties across ${scope.country.label}. Narrow further by choosing a state or city.`}
    />
  )
}
