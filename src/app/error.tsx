"use client"

import {
  ArrowCounterClockwiseIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** Below the root layout, so the header and navigation survive a render failure. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Stands in for the app's error reporter.
    console.error("[route-error]", error)
  }, [error])

  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WarningCircleIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Something went wrong loading this page</EmptyTitle>
        <EmptyDescription>
          The error has been logged. You can retry, or head back to the
          dashboard and try a different destination.
          {error.digest && (
            <span className="mt-2 block font-mono text-[0.7rem] opacity-70">
              Reference: {error.digest}
            </span>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={reset}>
            <ArrowCounterClockwiseIcon aria-hidden="true" />
            Try again
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/" />}>
            Back to all hotels
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
