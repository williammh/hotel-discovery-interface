"use client"

import {
  CalendarBlankIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr"
import * as React from "react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  parseIsoDate,
  toIsoDate,
  validateStay,
  type StayRange,
} from "@/domain/availability"
import { MAX_GUESTS, MIN_GUESTS, type HotelFilters } from "@/domain/filters"
import { formatDateLabel, formatLongDate } from "@/lib/format"

export type AvailabilityWindow = { start: string; end: string } | null

export type HotelSearchBarProps = {
  filters: HotelFilters
  availabilityWindow: AvailabilityWindow
  onChange: (update: Partial<HotelFilters>) => void
}

function toRange(stay: StayRange | null): DateRange | undefined {
  if (!stay) return undefined
  const from = parseIsoDate(stay.checkIn)
  const to = parseIsoDate(stay.checkOut)
  return from && to ? { from, to } : undefined
}

/**
 * The always-visible top bar: search, stay dates, and party size. Mirrors the
 * reference screenshot's structure; the narrower "quick filter" toggles live
 * separately in `HotelQuickFilters`, matching how the reference splits the
 * core query (bar) from optional refinements (chips below it).
 */
export function HotelSearchBar({
  filters,
  availabilityWindow,
  onChange,
}: HotelSearchBarProps) {
  const [isDatePickerOpen, setDatePickerOpen] = React.useState(false)
  const [isGuestsOpen, setGuestsOpen] = React.useState(false)
  // Only holds a check-in picked but not yet paired with a check-out; a
  // complete stay always lives in `filters.stay`, so this needs no effect to
  // stay in sync with it.
  const [pendingFrom, setPendingFrom] = React.useState<Date | undefined>()

  const range: DateRange | undefined = pendingFrom
    ? { from: pendingFrom, to: undefined }
    : toRange(filters.stay)

  function handleSelect(next: DateRange | undefined) {
    if (next?.from && !next.to) {
      setPendingFrom(next.from)
      return
    }

    setPendingFrom(undefined)
    const checkIn = next?.from ? toIsoDate(next.from) : null
    const checkOut = next?.to ? toIsoDate(next.to) : null
    const validation = validateStay(checkIn, checkOut)
    onChange({ stay: validation.status === "valid" ? validation.stay : null })
  }

  function handleDatePickerOpenChange(open: boolean) {
    setDatePickerOpen(open)
    if (!open) {
      setPendingFrom(undefined)
    }
  }

  function clearDates() {
    setPendingFrom(undefined)
    onChange({ stay: null })
  }

  const dateLabel = filters.stay
    ? `${formatDateLabel(filters.stay.checkIn)} – ${formatDateLabel(filters.stay.checkOut)}`
    : pendingFrom
      ? `${formatDateLabel(toIsoDate(pendingFrom))} – select check-out`
      : "Select dates"

  const defaultMonth =
    range?.from ?? parseIsoDate(availabilityWindow?.start ?? "") ?? undefined

  return (
    <div className="flex flex-col divide-y divide-border border border-border bg-card sm:flex-row sm:divide-x sm:divide-y-0">
      <div className="relative flex flex-1 items-center px-3 py-2">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute start-3 size-3.5 text-muted-foreground"
        />
        <Input
          aria-label="Search"
          type="search"
          value={filters.query}
          placeholder="Hotel name, city, or country"
          className="border-0 px-0 ps-5 shadow-none focus-visible:ring-0"
          onChange={(event) => onChange({ query: event.target.value })}
        />
      </div>

      <Popover open={isDatePickerOpen} onOpenChange={handleDatePickerOpenChange}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className="h-auto justify-start gap-2 rounded-none px-3 py-2 sm:min-w-[15rem]"
            />
          }
        >
          <CalendarBlankIcon aria-hidden="true" />
          <span className="truncate">{dateLabel}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            min={1}
            numberOfMonths={1}
            defaultMonth={defaultMonth}
            selected={range}
            onSelect={handleSelect}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border p-2.5">
            {availabilityWindow ? (
              <p className="text-xs text-muted-foreground">
                Availability runs {formatLongDate(availabilityWindow.start)}{" "}
                – {formatLongDate(availabilityWindow.end)}.
              </p>
            ) : (
              <span />
            )}
            {(filters.stay || pendingFrom) && (
              <Button variant="ghost" size="sm" onClick={clearDates}>
                Clear dates
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={isGuestsOpen} onOpenChange={setGuestsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className="h-auto justify-start gap-2 rounded-none px-3 py-2"
            />
          }
        >
          <UsersIcon aria-hidden="true" />
          {filters.guests} {filters.guests === 1 ? "guest" : "guests"}
        </PopoverTrigger>
        <PopoverContent className="w-56" align="end">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium">Guests</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Fewer guests"
                disabled={filters.guests <= MIN_GUESTS}
                onClick={() =>
                  onChange({ guests: Math.max(MIN_GUESTS, filters.guests - 1) })
                }
              >
                <MinusIcon aria-hidden="true" />
              </Button>
              <span
                className="w-4 text-center text-xs tabular-nums"
                aria-live="polite"
              >
                {filters.guests}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="More guests"
                disabled={filters.guests >= MAX_GUESTS}
                onClick={() =>
                  onChange({ guests: Math.min(MAX_GUESTS, filters.guests + 1) })
                }
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          <Separator className="my-1" />
          <p className="text-xs text-muted-foreground">
            Only shows hotels with a room that sleeps your party
            {filters.stay ? " for every night of your stay." : "."}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
