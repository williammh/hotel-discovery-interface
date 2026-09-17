import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder in the dashboard's layout while a route's results render. */
export function HotelListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      data-viewport-fill
      className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_2fr] lg:grid-rows-[minmax(0,1fr)] lg:gap-8"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-6 lg:min-h-0">
        <div className="hidden shrink-0 flex-col gap-5 lg:flex">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          {Array.from({ length: count }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      </div>
      <div className="hidden lg:block" />
    </div>
  )
}
