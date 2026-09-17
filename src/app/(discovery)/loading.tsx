import { HotelListSkeleton } from "@/components/hotels/hotel-list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Navigation placeholder while a destination's results are rendered. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-56" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>
      <HotelListSkeleton />
    </div>
  )
}
