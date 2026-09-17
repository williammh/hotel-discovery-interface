import { StarIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "cn"

type RatingStarsSize = "sm" | "md"

const sizeClasses: Record<RatingStarsSize, string> = {
  sm: "size-3",
  md: "size-4",
}

/** The official classification, not the guest score (see `GuestRating`). */
export function RatingStars({
  rating,
  size = "sm",
  className,
}: {
  rating: number
  size?: RatingStarsSize
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${rating}-star hotel`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          key={index}
          aria-hidden="true"
          weight={index < rating ? "fill" : "regular"}
          className={cn(
            sizeClasses[size],
            index < rating ? "text-foreground" : "text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  )
}
