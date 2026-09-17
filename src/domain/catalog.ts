import seed from "@/data/mock-data.json"

import { slugifySegment } from "@/lib/slug"
import { getAvailabilityWindow } from "./availability"
import { getCoordinateLookup } from "./coordinates"
import { normalizeHotels, type Hotel } from "./normalize"

/**
 * The only module that reads hotel data, so swapping the seed for an API changes
 * nothing above it. Public data, so not `server-only`: tests import it directly.
 */
const dataset = normalizeHotels(seed, getCoordinateLookup())

if (dataset.issues.length > 0 && process.env.NODE_ENV !== "test") {
  console.warn(
    `[catalog] seed loaded with ${dataset.issues.length} data issue(s):`,
    dataset.issues
  )
}

export type LocationNode = {
  slug: string
  label: string
  hotelCount: number
}

export type LocationScope = {
  country: LocationNode
  state?: LocationNode
  city?: LocationNode
}

export type Destination = LocationNode & {
  states: (LocationNode & { cities: LocationNode[] })[]
}

export function getAllHotels(): Hotel[] {
  return dataset.hotels
}

export function getHotelById(id: string): Hotel | undefined {
  return dataset.hotels.find((hotel) => hotel.id === id)
}

export function getCatalogAvailabilityWindow() {
  return getAvailabilityWindow(dataset.hotels)
}

function toNode(label: string, slug: string, hotels: readonly Hotel[]) {
  return { slug, label, hotelCount: hotels.length }
}

export function getDestinations(): Destination[] {
  const hotels = getAllHotels()
  const countries = new Map<string, Hotel[]>()

  for (const hotel of hotels) {
    const existing = countries.get(hotel.slugs.country)
    if (existing) {
      existing.push(hotel)
    } else {
      countries.set(hotel.slugs.country, [hotel])
    }
  }

  return [...countries.entries()]
    .map(([countrySlug, countryHotels]) => {
      const states = new Map<string, Hotel[]>()
      for (const hotel of countryHotels) {
        const existing = states.get(hotel.slugs.state)
        if (existing) {
          existing.push(hotel)
        } else {
          states.set(hotel.slugs.state, [hotel])
        }
      }

      return {
        ...toNode(countryHotels[0].address.country, countrySlug, countryHotels),
        states: [...states.entries()]
          .map(([stateSlug, stateHotels]) => {
            const cities = new Map<string, Hotel[]>()
            for (const hotel of stateHotels) {
              const existing = cities.get(hotel.slugs.city)
              if (existing) {
                existing.push(hotel)
              } else {
                cities.set(hotel.slugs.city, [hotel])
              }
            }

            return {
              ...toNode(stateHotels[0].address.state, stateSlug, stateHotels),
              cities: [...cities.entries()]
                .map(([citySlug, cityHotels]) =>
                  toNode(cityHotels[0].address.city, citySlug, cityHotels)
                )
                .sort((a, b) => a.label.localeCompare(b.label)),
            }
          })
          .sort((a, b) => a.label.localeCompare(b.label)),
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

export type ScopeRequest = {
  country: string
  state?: string
  city?: string
}

/** `null` becomes a 404: a URL typo is a different failure from "no hotels match". */
export function resolveScope(request: ScopeRequest): LocationScope | null {
  const countrySlug = slugifySegment(request.country)
  const inCountry = getAllHotels().filter(
    (hotel) => hotel.slugs.country === countrySlug
  )

  if (inCountry.length === 0) {
    return null
  }

  const scope: LocationScope = {
    country: toNode(inCountry[0].address.country, countrySlug, inCountry),
  }

  if (request.state === undefined) {
    return scope
  }

  const stateSlug = slugifySegment(request.state)
  const inState = inCountry.filter((hotel) => hotel.slugs.state === stateSlug)

  if (inState.length === 0) {
    return null
  }

  scope.state = toNode(inState[0].address.state, stateSlug, inState)

  if (request.city === undefined) {
    return scope
  }

  const citySlug = slugifySegment(request.city)
  const inCity = inState.filter((hotel) => hotel.slugs.city === citySlug)

  if (inCity.length === 0) {
    return null
  }

  scope.city = toNode(inCity[0].address.city, citySlug, inCity)

  return scope
}

export function getHotelsInScope(scope: LocationScope | null): Hotel[] {
  if (!scope) {
    return getAllHotels()
  }

  return getAllHotels().filter((hotel) => {
    if (hotel.slugs.country !== scope.country.slug) return false
    if (scope.state && hotel.slugs.state !== scope.state.slug) return false
    if (scope.city && hotel.slugs.city !== scope.city.slug) return false
    return true
  })
}

export function getCitiesInScope(hotels: readonly Hotel[]): LocationNode[] {
  const cities = new Map<string, Hotel[]>()

  for (const hotel of hotels) {
    const existing = cities.get(hotel.slugs.city)
    if (existing) {
      existing.push(hotel)
    } else {
      cities.set(hotel.slugs.city, [hotel])
    }
  }

  return [...cities.entries()]
    .map(([slug, cityHotels]) =>
      toNode(cityHotels[0].address.city, slug, cityHotels)
    )
    .sort((a, b) => a.label.localeCompare(b.label))
}
