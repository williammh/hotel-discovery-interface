"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "@phosphor-icons/react/dist/ssr"
import * as React from "react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

const NEXT_THEME = {
  light: "dark",
  dark: "system",
  system: "light",
} as const

const THEME_ICON = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
} as const

const subscribeToNothing = () => () => {}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  // The server can't know the stored theme, so it renders the "system" icon.
  // `useSyncExternalStore` swaps in the real one without a hydration mismatch.
  const isHydrated = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )

  const Icon = THEME_ICON[theme]

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}.`}
      onClick={() => setTheme(NEXT_THEME[theme])}
    >
      {isHydrated ? (
        <Icon aria-hidden="true" />
      ) : (
        <MonitorIcon aria-hidden="true" />
      )}
    </Button>
  )
}
