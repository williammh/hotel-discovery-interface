import { ScopedDiscovery } from "@/components/hotels/scoped-discovery"
import type { RawSearchParams } from "@/domain/filters"

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  return <ScopedDiscovery scope={null} searchParams={searchParams} />
}
