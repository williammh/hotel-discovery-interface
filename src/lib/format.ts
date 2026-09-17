import { format } from "date-fns"

import { parseIsoDate } from "@/domain/availability"

/** The seed has no currency field, so every rate is presented as USD. */
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatCount(value: number): string {
  return compactNumberFormatter.format(value)
}

/** The seed mixes `fitness_center` with `free Wi-Fi`; capitalised words are left alone. */
export function formatAmenity(amenity: string): string {
  return amenity
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word === word.toLowerCase()
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(" ")
}

/** "Fri, Jul 10" */
export function formatDateLabel(isoDate: string): string {
  const parsed = parseIsoDate(isoDate)
  return parsed ? format(parsed, "EEE, MMM d") : isoDate
}

/** "Jul 10, 2026" */
export function formatLongDate(isoDate: string): string {
  const parsed = parseIsoDate(isoDate)
  return parsed ? format(parsed, "MMM d, yyyy") : isoDate
}

export function formatNights(nightCount: number): string {
  return `${nightCount} ${nightCount === 1 ? "night" : "nights"}`
}

export function formatAddress(address: {
  street: string
  city: string
  state: string
  zip_code: string
}): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip_code}`
}
