# Stayfinder — Hotel Discovery Interface

A hotel discovery front end built with **Next.js 16 (App Router)**, **React 19**,
**TypeScript**, **Tailwind CSS v4**, and **shadcn/ui** (the Base UI `base-lyra`
style). It reads the supplied `mock-data.json` seed — 40 properties across 10
cities — and delivers three things: a search-and-filter dashboard, a detail view
per property, and a date-driven room availability checker.

See [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) for the major architectural
decisions, the tradeoffs of each, and the assumptions made about the dataset.

---

## Getting started

Requires **Node.js 22+** (the toolchain's `@types/node` and Vitest both expect
it) and npm.

```bash
npm install          # install dependencies
npm run dev          # start the dev server on http://localhost:3000
```

Other scripts:

| Script               | What it does                                 |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Dev server with Fast Refresh                 |
| `npm run build`      | Production build                             |
| `npm run start`      | Serve the production build                   |
| `npm test`           | Run the unit and component tests once        |
| `npm run test:watch` | Run tests in watch mode                      |
| `npm run test:e2e`   | Build, serve, and run the Playwright test    |
| `npm run typecheck`  | `tsc --noEmit`                               |
| `npm run lint`       | ESLint over the whole project                |
| `npm run format`     | Prettier                                     |
| `npm run geocode`    | Refresh hotel coordinates from OpenStreetMap |

## Testing

```bash
npm test
```

**Vitest** + **Testing Library**, in a jsdom environment, split into two layers:

- **Domain tests** (`src/domain/*.test.ts`, `src/lib/format.test.ts`) — pure
  functions, no React. These cover the filter/sort matrix, the half-open
  date-range maths, stay validation, dataset normalisation, and slug routing.
  `catalog.test.ts` runs against the _real_ `mock-data.json`, so it doubles as a
  contract test for the seed (40 properties, 10 cities × 4, 15% fully booked).
- **Component tests** (`src/components/**/*.test.tsx`) — behaviour a user can
  observe, driven through `user-event` and queried by role and label rather than
  class names. These cover filtering as you type, multi-select star ratings, the
  two distinct empty states, the availability checker's outcomes, and the
  debounced URL sync.

Next's router and `next/link` are stubbed once in `src/test/setup.tsx`, which also
exports a `routerMock` so tests can assert on the navigation a component
triggers.

### End-to-end

```bash
npx playwright install chromium   # first run only
npm run test:e2e
```

One **Playwright** test runs against a production build that the config starts
on port 3100. It checks that a shared filtered link
(`/usa/il/chicago?stars=3`) arrives with the filtered results already rendered,
that typing a search narrows the list and rewrites the URL, and that a reload
rebuilds the same view from the URL.

---

## The globe

The dashboard's right two-thirds is a 3D globe (Aceternity `Globe3D`, built on
`three` / `@react-three/fiber`) plotting the **currently filtered** results, so
narrowing the list visibly narrows the map. Drag to rotate, scroll to zoom,
right-drag to pan. It auto-rotates on arrival and yields the moment you touch
it — a spinning globe makes pins impossible to click.

Clicking a pin drills in: a single hotel opens its detail page, a clustered city
opens that city's route.

The globe is loaded via `next/dynamic` with `ssr: false` (WebGL has no
server-side equivalent) and is hidden below `lg`, where there's no room for it
beside the list and a WebGL canvas would be the most expensive thing on a phone.

### The 2D map fallback

WebGL is not guaranteed. A browser can refuse a context outright, or take one
away mid-session once a page has lost too many ("Web page caused context loss
and was blocked"), which used to surface as a runtime error where the globe
should be. Instead, `HotelGlobe` falls back to a flat **OpenStreetMap** view
(`hotel-map.tsx`) that plots the same pins, with the same labels and the same
click-through, when any of these happen:

- the browser reports no WebGL support at all,
- the canvas throws while starting up, or the globe chunk fails to load,
- the GPU takes the context away after the globe was already running.

The toggle in the top-right corner switches between the two by hand, so the map
is also there for anyone who just prefers it — and picking **3D globe** after a
failure retries the canvas from scratch.

The map is hand-rolled from raster OSM tiles (`domain/mercator.ts` does the Web
Mercator maths): drag to pan, scroll or the corner buttons to zoom, pins are
real focusable buttons. No map library, because the fallback shouldn't weigh
more than the thing it stands in for.

### Geocoding

Coordinates come from **OpenStreetMap Nominatim**, resolved **offline** into
`src/data/hotel-coordinates.json` by `npm run geocode`. Nominatim's usage policy
caps the public endpoint at one request per second and forbids bulk or
per-page-view querying, so the app never calls it at request time — it only
reads the generated cache.

```bash
npm run geocode              # fill in any hotel that isn't cached yet
npm run geocode -- --force   # re-geocode everything
NOMINATIM_EMAIL=you@example.com npm run geocode   # recommended contact header
```

The script tries the full street address first, then a free-form query, then
falls back to the city. **Every hotel in the supplied seed lands on the city
fallback**, because the seed's street addresses (`789 Skyline Blvd`,
`412 Canary Way`) are fictional and match nothing in OSM. That means the four
hotels in each city share one coordinate, so `buildGlobePins` groups hotels at
the same position into a single pin labelled `Chicago, USA · 4 hotels`. A
single-hotel pin is labelled with its name, city, and country — e.g.
`The Grand Luminary, Chicago, USA`. Swap in real addresses and the same code
gives each hotel its own pin, no changes needed.

Geocoding data is © OpenStreetMap contributors (ODbL) — attribution is rendered
in the corner of the globe, as the licence requires.

## Routes

| Route                       | Renders                                                |
| --------------------------- | ------------------------------------------------------ |
| `/`                         | Dashboard over all 40 properties                       |
| `/{country}`                | Properties in that country (e.g. `/usa`)               |
| `/{country}/{state}`        | Properties in that state (e.g. `/usa/il`)              |
| `/{country}/{state}/{city}` | Properties in that city (e.g. `/usa/il/chicago`)       |
| `/hotel/{id}`               | Detail view + availability checker (`/hotel/hotel-01`) |

Location segments are slugs generated from the dataset and matched
diacritic-insensitively, so `/france/ile-de-france/paris` resolves
`Île-de-France`. A segment that doesn't name a real place — or a state that
exists but not inside that country, like `/france/il` — returns a 404 rather
than an empty list.

The detail route is namespaced under `/hotel/` because Next.js cannot host two
different dynamic segments (`[id]` and `[country]`) at the same level. See
[DESIGN_DECISIONS.md](DESIGN_DECISIONS.md#7-routing-a-location-hierarchy-and-a-namespaced-detail-route).

---

## State management

There are three kinds of state in this app, and each lives in a different place.

### 1. Catalogue data — server only

The seed is parsed, validated, and normalised **once at module load** in
`src/domain/catalog.ts`. Pages are Server Components that call into it directly;
no fetching, no client-side cache, no data library. Swapping the seed for a real
API means changing that one module.

### 2. Filters — the URL is the source of truth

Filter state (`q`, `city`, `stars`, `minPrice`, `maxPrice`, `sort`) lives in the
query string, which makes a filtered view shareable, bookmarkable, and
refresh-proof.

The flow is deliberately two-directional:

- **Server:** the page reads `searchParams`, parses them with
  `parseFilters` (Zod-backed, tolerant of junk), and renders the filtered
  results, so the first HTML response for a shared link already holds the list.
- **Client:** `useHotelFilters` seeds local state from those same filters and
  re-runs the _same pure functions_ on every keystroke, so interaction is
  instant. The URL is rewritten on a 250 ms debounce with `router.replace`, so
  dragging a slider doesn't fill the back button.
- **Back/forward:** `useHotelFilters` diffs every incoming `initialFilters`
  against the query string it last wrote itself; a URL it didn't write (back,
  forward, a filtered link) is adopted into local state in place, with no
  remount. `ScopedDiscovery` still keys `HotelDiscovery` on the destination
  (country/state/city), so navigating to a different scope gets a fresh
  instance — a fresh globe, fresh scroll position, fresh everything.

`useHotelFilters` deliberately does **not** call `useSearchParams` — doing so
opts the entire page out of server rendering.

No global store is used. Filters are scoped to one route; a Redux/Zustand store
would add indirection without removing any.

### 3. Stay dates — local component state

The availability checker owns its own `check-in`/`check-out` range with
`useState`. It is self-contained on one page and nothing else reads it, so
lifting it further would be premature.

---

## Component breakdown

The guiding rule is that **logic is pure and lives in `src/domain`; components
render and nothing else.** Every filter, sort, date, and availability decision
is a plain function that can be tested without mounting React.

```
src/
├── data/
│   ├── mock-data.json       The supplied seed
│   └── hotel-coordinates.json  Geocoding cache written by `npm run geocode`
│
├── domain/                  Pure, framework-free business logic
│   ├── hotel.schema.ts      Zod schema for the seed
│   ├── normalize.ts         Validate → dedupe → derive slugs/prices; reports data issues
│   ├── catalog.ts           The data layer: queries, location tree, scope resolution
│   ├── summary.ts           Trimmed projection sent to client components
│   ├── filters.ts           Filter/sort predicates + search-param parsing & serialising
│   └── availability.ts      Half-open date maths, stay validation, room matching
│
├── hooks/
│   └── use-hotel-filters.ts Local filter state ⇄ debounced URL sync
│
├── lib/
│   ├── format.ts            Currency, dates, amenity labels
│   └── slug.ts              Diacritic-safe slugs for the location routes
│
├── test/
│   ├── setup.tsx            Vitest setup: jest-dom matchers, router and Link stubs
│   └── fixtures.ts          Builds hotels through the real normalisation pipeline
│
├── app/                     Routes — all Server Components
│   ├── (discovery)/         Dashboard routes (the group name isn't part of the URL)
│   │   ├── page.tsx         Dashboard
│   │   ├── [country]/…      The three nested location levels
│   │   └── loading.tsx      Results skeleton, scoped to the dashboard routes
│   ├── hotel/[id]/page.tsx  Detail view
│   ├── error.tsx            Route error boundary
│   ├── global-error.tsx     Root error boundary
│   └── not-found.tsx        404 with real destinations to recover to
│
└── components/
    ├── hotels/
    │   ├── scoped-discovery.tsx        Server: narrows by route, parses filters, renders results
    │   ├── hotel-discovery.tsx         Client: the interactive dashboard shell
    │   ├── hotel-filter-controls.tsx   Client: the filter form (sidebar + mobile sheet)
    │   ├── hotel-card.tsx              One result
    │   ├── room-availability-checker.tsx  Client: date picker + availability outcomes
    │   ├── room-card.tsx               One room type, in the context of a stay
    │   ├── rating-stars.tsx / guest-rating.tsx / amenity-badges.tsx
    │   ├── location-breadcrumbs.tsx    The `/{country}/{state}/{city}` trail
    │   └── hotel-list-skeleton.tsx
    ├── layout/              Header, destination menu, theme toggle
    └── ui/                  shadcn/ui primitives (generated)
```

`ScopedDiscovery` is the seam: it is rendered by all four location routes, and
it is the only place that knows both the route scope and the filter state.

### Server vs. client split

Server Components are the default. `"use client"` appears only on leaves that
genuinely need it: the filter shell, the filter form, the availability checker,
the theme toggle, the destination menu, and the interactive shadcn primitives.
Client components receive a trimmed `HotelSummary` — never the full record with
every room and every bookable night.

---

## Error, empty, and edge-case states

Each of these is reachable in the running app.

| State                        | Where          | What the user sees                                                                     |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| No hotels match the filters  | Dashboard      | "No hotels found matching criteria" + a **Clear all filters** action                   |
| Destination has no hotels    | Dashboard      | A _different_ message — "No properties listed in X" — with no clear-filters suggestion |
| No rooms for the dates       | Detail view    | "No rooms available for these dates", naming how many room types were checked          |
| Partially available room     | Detail view    | Kept in an "Not available for these dates" section that names the blocking nights      |
| Fully booked property        | Dashboard card | A **Fully booked** badge (6 of the 40 — the seed's 15%)                                |
| Only one date chosen         | Detail view    | "Choose your stay" prompt instead of a guess                                           |
| Unusable range               | Detail view    | A destructive alert (check-out before check-in, unparseable date, stay over 30 nights) |
| Unknown hotel or destination | Any route      | 404 page listing the real destinations                                                 |
| Render failure               | Any route      | `error.tsx` boundary: retry + escape hatch, header and nav intact                      |
| Shell failure                | Root layout    | `global-error.tsx`, styled inline since providers may be the thing that broke          |
| Hand-edited query string     | Dashboard      | Junk degrades per-field to that field's default; the page still renders                |
| Malformed record in the seed | Startup        | Dropped, logged as a data issue; the rest of the catalogue still loads                 |

Empty states distinguish **"you filtered everything out"** (recoverable — offer
the reset) from **"there is nothing here"** (not the user's fault — don't).

## Responsive behaviour

Built mobile-first and verified at 390 px, 834 px, and 1280 px.

- **≥1024 px:** the dashboard fills one viewport. Filters and a single column of
  results share the left third, with the results scrolling in their own area;
  the globe takes the right two-thirds.
- **<1024 px:** an ordinary scrolling page with one result per row. The globe is
  hidden and filters move into a slide-over sheet reached from a **Filters**
  button that badges the active filter count.

Because the layout is driven by viewport width rather than device sniffing, a
phone browser in "desktop mode" (reporting a ~980 px viewport) gets the
single-column layout and stays usable. Dark mode follows the system preference and can be
overridden from the header; the stored choice is applied before first paint, so
there's no flash.
