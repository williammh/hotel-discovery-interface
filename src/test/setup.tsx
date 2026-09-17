import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// Component tests have no App Router context; `routerMock` lets them assert navigation.
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}

export const pathnameMock = { current: "/" }

// `useHotelFilters` writes via the native History API, not the router mock
// above — see DESIGN_DECISIONS.md section 5. Mocked to no-ops so tests can
// assert on calls without mutating jsdom's real `window.location` between tests.
export const historyMock = {
  replaceState: vi
    .spyOn(window.history, "replaceState")
    .mockImplementation(() => {}),
  pushState: vi.spyOn(window.history, "pushState").mockImplementation(() => {}),
}

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => pathnameMock.current,
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND")
  },
}))

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  pathnameMock.current = "/"
})
