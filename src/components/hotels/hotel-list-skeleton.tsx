import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder in the dashboard's layout while a route's results render. */
export function HotelListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1" aria-hidden="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[3.25rem] w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-24 shrink-0" />
          ))}
        </div>
      </div>

      <div
        data-viewport-fill
        className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_2fr] lg:grid-rows-[minmax(0,1fr)] lg:gap-8"
      >
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          {Array.from({ length: count }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
        <div className="hidden lg:block" />
      </div>
    </div>
  )
}
