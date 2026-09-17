import type { Metadata, Viewport } from "next"

import { SiteHeader } from "@/components/layout/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeScript } from "@/components/theme-script"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Stayfinder — Hotel discovery",
    template: "%s · Stayfinder",
  },
  description:
    "Browse, filter, and check room availability across a global catalogue of hotels.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-svh antialiased">
        <ThemeProvider>
          {/* Pages containing `data-viewport-fill` are locked to one screen on desktop. */}
          <div className="flex min-h-svh flex-col lg:has-[[data-viewport-fill]]:h-svh">
            <SiteHeader />
            <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
              {children}
            </main>
            <footer className="border-t py-6">
              <p className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground sm:px-6">
                Prototype built on a static catalogue seed. Rates shown in USD.
              </p>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
