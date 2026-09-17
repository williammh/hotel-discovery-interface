import { describe, expect, it } from "vitest"

import {
  formatAmenity,
  formatCurrency,
  formatDateLabel,
  formatNights,
} from "./format"

describe("formatAmenity", () => {
  it("title-cases snake_case keys", () => {
    expect(formatAmenity("fitness_center")).toBe("Fitness Center")
    expect(formatAmenity("public_hot_spring_bath")).toBe(
      "Public Hot Spring Bath"
    )
  })

  it("preserves words that already carry capitals", () => {
    expect(formatAmenity("free Wi-Fi")).toBe("Free Wi-Fi")
  })
})

describe("formatCurrency", () => {
  it("renders whole-dollar amounts", () => {
    expect(formatCurrency(299)).toBe("$299")
    expect(formatCurrency(1240.5)).toBe("$1,241")
  })
})

describe("formatDateLabel", () => {
  it("renders a weekday and short date", () => {
    expect(formatDateLabel("2026-07-10")).toBe("Fri, Jul 10")
  })

  it("falls back to the raw value when unparseable", () => {
    expect(formatDateLabel("nonsense")).toBe("nonsense")
  })
})

describe("formatNights", () => {
  it("pluralises", () => {
    expect(formatNights(1)).toBe("1 night")
    expect(formatNights(3)).toBe("3 nights")
  })
})
