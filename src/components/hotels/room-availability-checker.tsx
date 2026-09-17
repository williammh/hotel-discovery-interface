"use client"

import {
  CalendarBlankIcon,
  CalendarXIcon,
  InfoIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import * as React from "react"
import type { DateRange } from "react-day-picker"

import { RoomCard } from "@/components/hotels/room-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  getHotelAvailability,
  MAX_STAY_NIGHTS,
  parseIsoDate,
  toIsoDate,
  validateStay,
  type StayError,
} from "@/domain/availability"
import type { Room } from "@/domain/normalize"
import { formatLongDate, formatNights } from "@/lib/format"

export type AvailabilityWindow = { start: string; end: string }

const ERROR_MESSAGES: Record<StayError, string> = {
  incomplete: "Pick a check-out date to see which rooms are open.",
  "invalid-date": "Those dates could not be read. Please pick them again.",
  "checkout-not-after-checkin":
    "Check-out has to be at least one night after check-in.",
  "too-long": `Stays are limited to ${MAX_STAY_NIGHTS} nights.`,
}

function toRange(stay: AvailabilityWindow | null): DateRange | undefined {
  if (!stay) {
    return undefined
  }

  const from = parseIsoDate(stay.start)
  const to = parseIsoDate(stay.end)

  return from && to ? { from, to } : undefined
}

/** Matching lives in `domain/availability`; this only chooses what each outcome shows. */
export function RoomAvailabilityChecker({
  rooms,
  suggestedStay,
  availabilityWindow,
}: {
  rooms: readonly Room[]
  suggestedStay: AvailabilityWindow | null
  availabilityWindow: AvailabilityWindow | null
}) {
  const [range, setRange] = React.useState<DateRange | undefined>(() =>
    toRange(suggestedStay)
  )
  const [isPickerOpen, setPickerOpen] = React.useState(false)

  const checkIn = range?.from ? toIsoDate(range.from) : null
  const checkOut = range?.to ? toIsoDate(range.to) : null
  const validation = validateStay(checkIn, checkOut)

  // A handful of rooms times a handful of nights: memoising would cost more than it saves.
  const availability = getHotelAvailability(
    rooms,
    validation.status === "valid" ? validation.nights : []
  )

  const defaultMonth = React.useMemo(() => {
    const anchor = range?.from ?? parseIsoDate(availabilityWindow?.start ?? "")
    return anchor ?? undefined
  }, [range?.from, availabilityWindow?.start])

  const triggerLabel =
    checkIn && checkOut
      ? `${formatLongDate(checkIn)} – ${formatLongDate(checkOut)}`
      : checkIn
        ? `${formatLongDate(checkIn)} – select check-out`
        : "Select your dates"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={isPickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="lg"
                className="min-w-[16rem] justify-start"
              />
            }
          >
            <CalendarBlankIcon aria-hidden="true" />
            <span className="truncate">{triggerLabel}</span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              autoFocus
              mode="range"
              min={2}
              numberOfMonths={1}
              defaultMonth={defaultMonth}
              selected={range}
              onSelect={setRange}
            />
          </PopoverContent>
        </Popover>

        {validation.status === "valid" && (
          <p className="text-xs text-muted-foreground">
            {formatNights(validation.nights.length)}
          </p>
        )}

        {range && (
          <Button variant="ghost" size="sm" onClick={() => setRange(undefined)}>
            Clear dates
          </Button>
        )}
      </div>

      {availabilityWindow && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          This catalogue carries availability between{" "}
          {formatLongDate(availabilityWindow.start)} and{" "}
          {formatLongDate(availabilityWindow.end)}.
        </p>
      )}

      <Separator />

      {validation.status !== "valid" ? (
        <Alert
          variant={validation.status === "invalid" ? "destructive" : "default"}
        >
          {validation.status === "invalid" ? (
            <WarningCircleIcon aria-hidden="true" />
          ) : (
            <CalendarBlankIcon aria-hidden="true" />
          )}
          <AlertTitle>
            {validation.status === "invalid"
              ? "Check those dates"
              : "Choose your stay"}
          </AlertTitle>
          <AlertDescription>
            {
              ERROR_MESSAGES[
                validation.status === "invalid"
                  ? validation.reason
                  : "incomplete"
              ]
            }
          </AlertDescription>
        </Alert>
      ) : availability.available.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarXIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No rooms available for these dates</EmptyTitle>
            <EmptyDescription>
              All {rooms.length} room {rooms.length === 1 ? "type" : "types"}{" "}
              are booked for at least one night of this stay. Try shifting your
              dates or shortening the trip.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section aria-label="Available rooms" className="flex flex-col gap-3">
          <h3 className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {availability.available.length}
            </span>{" "}
            of {rooms.length} room {rooms.length === 1 ? "type" : "types"}{" "}
            available for {formatNights(availability.nightCount)}
          </h3>

          <ul className="flex flex-col gap-3">
            {availability.available.map((entry) => (
              <li key={entry.room.room_id} className="flex">
                <RoomCard
                  availability={entry}
                  nightCount={availability.nightCount}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {validation.status === "valid" && availability.unavailable.length > 0 && (
        <section
          aria-label="Unavailable rooms"
          className="flex flex-col gap-3 pt-2"
        >
          <h3 className="text-xs text-muted-foreground">
            Not available for these dates
          </h3>
          <ul className="flex flex-col gap-3">
            {availability.unavailable.map((entry) => (
              <li key={entry.room.room_id} className="flex">
                <RoomCard
                  availability={entry}
                  nightCount={availability.nightCount}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
