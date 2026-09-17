import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ScopedDiscovery } from "@/components/hotels/scoped-discovery"
import { resolveScope } from "@/domain/catalog"
import type { RawSearchParams } from "@/domain/filters"

type StateParams = { country: string; state: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<StateParams>
}): Promise<Metadata> {
  const scope = resolveScope(await params)

  if (!scope?.state) {
    return { title: "Destination not found" }
  }

  return {
    title: `Hotels in ${scope.state.label}, ${scope.country.label}`,
    description: `${scope.state.hotelCount} properties across ${scope.state.label}.`,
  }
}

export default async function StatePage({
  params,
  searchParams,
}: {
  params: Promise<StateParams>
  searchParams: Promise<RawSearchParams>
}) {
  const scope = resolveScope(await params)

  if (!scope?.state) {
    notFound()
  }

  return (
    <ScopedDiscovery
      scope={scope}
      searchParams={searchParams}
      title={`Hotels in ${scope.state.label}`}
      description={`${scope.state.hotelCount} properties in ${scope.state.label}, ${scope.country.label}.`}
    />
  )
}
