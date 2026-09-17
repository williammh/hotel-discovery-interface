import { cn } from "cn"

import { formatCount } from "@/lib/format"

export function GuestRating({
  rating,
  reviewCount,
  className,
}: {
  rating: number
  reviewCount: number
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="rounded-none bg-secondary px-1.5 py-0.5 font-heading text-xs font-medium text-secondary-foreground tabular-nums">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatCount(reviewCount)} reviews
      </span>
    </span>
  )
}
