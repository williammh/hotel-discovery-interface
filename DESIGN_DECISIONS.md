# Design Decisions

This file covers the architectural calls behind Stayfinder: why each one was made, what it costs, and what would change at a larger scale. Setup, scripts, and the component tree are in [README.md](README.md). This file explains the reasons behind them.

The decisions are grouped by layer. Each one ends with its tradeoffs, because none of these came free.

---

## 1. Framework: Next.js App Router over a client-only SPA

The brief allows any stack and mentions the team uses Vue. This is Next.js 16 with React 19 and TypeScript. The main reason is server rendering of filtered views. A link like `/usa/il/chicago?stars=5&maxPrice=250` should arrive as HTML with the right hotels in it, not as a spinner that fills in after hydration. Server Components also keep the dataset, the Zod schema, and the normalisation code out of the browser bundle entirely.

The project began as a Vite scaffold and was converted. `vite.config.ts`, `index.html`, and `src/main.tsx` were replaced by the App Router, and Tailwind moved from `@tailwindcss/vite` to `@tailwindcss/postcss`. Vite stays on as Vitest's engine, and the existing shadcn theme, fonts, and Prettier config were kept.

Tradeoffs:

- It isn't Vue. The domain layer (section 2) has no React imports, so the filtering, availability, and routing logic would move to a Vue app unchanged. The components would have to be rewritten.
- Next 16 has breaking changes from earlier versions (async `params` and `searchParams`, for one), so the framework is a moving target.
- A server runtime is needed for the location routes (section 7). A static SPA could be hosted anywhere.

---

## 2. Business logic lives in a framework-free domain layer

Everything in `src/domain` is a plain function over plain data: filtering, sorting, query-string parsing, date arithmetic, availability matching, slug resolution, globe pin grouping. None of it imports React or Next, and none of it does I/O except `catalog.ts` and `coordinates.ts`, which read JSON at module load.

That split does most of the work for the brief's "clear separation of UI elements from data handling logic". It's also why the test suite runs fast. The half-open date logic has its own tests (`availability.test.ts`) and never mounts a component. The component tests only check what a user can see.

`HotelFilterControls` is a fully controlled form, so the same instance works in the desktop sidebar and inside the mobile sheet. `RoomCard` renders both the available and unavailable outcome instead of splitting into two components that would drift apart.

Tradeoffs:

- There's one more layer than an app this size strictly needs. A reader has to follow `page.tsx -> ScopedDiscovery -> catalog -> normalize` to see where data comes from.
- Some domain modules return presentation-adjacent strings (globe pin labels, for example). That was a judgement call: the labels are derived purely from data and are worth testing without React.

---

## 3. The seed is validated at the boundary, and bad records are dropped instead of thrown on

`mock-data.json` is parsed with Zod in `hotel.schema.ts` and normalised once in `normalize.ts`. Above that point every layer can trust the shape. Treating a hand-authored JSON file as untrusted might look paranoid. It isn't, because the seed has real defects:

- Five hotels (02, 19, 21, 25, 27) repeat a `room_id` inside the same hotel. Keeping both would double-count inventory and produce duplicate React keys, so the first occurrence wins and the collision is recorded.
- Hotels 17, 36, and 40 contain duplicate JSON keys. `JSON.parse` keeps the last value, and in each case both copies are identical, so this has no visible effect.
- Amenity strings mix `snake_case` (`fitness_center`) with prose (`free Wi-Fi`). `formatAmenity` title-cases lowercase words and leaves capitalised ones alone, so "Wi-Fi" survives.

A record that fails validation is dropped and collected as a typed `DataIssue`. The other 39 still load. On boot this logs `[catalog] seed loaded with 5 data issue(s)`, which are the duplicate rooms. One bad row in a catalogue should degrade a single listing, not take down discovery.

Normalisation also derives the fields the UI actually filters on: `slugs`, `priceFrom` (the cheapest room), `hasAnyAvailability`, and `coordinates`. They are computed once instead of on every render.

Tradeoffs:

- Silently dropping data is dangerous in production. Here the issues go to `console.warn`. A real system would send them to an error reporter and alert on a nonzero count.
- The schema is strict about types but loose about semantics. It doesn't check that `available_dates` are real calendar days or that a zip code matches its city.
- Parsing happens at module load, so a malformed seed shows up when the server starts, not at build time. A CI check that imports the catalogue would catch it earlier. The contract tests in section 12 partly cover this.

---

## 4. Clients receive a trimmed `HotelSummary`, never the full record

A `Hotel` carries every room and every bookable night. The dashboard needs none of that. `summary.ts` defines a narrow projection (name, ratings, city, amenities, `priceFrom`, `hasAnyAvailability`, room count, coordinates), and that is all that crosses into client components.

The detail page is the exception. It passes `hotel.rooms` to `RoomAvailabilityChecker`, because availability has to be computed against the actual dates as the user picks them.

Tradeoffs:

- There are two types for one entity, with a mapper between them. Adding a field the dashboard needs means touching `summary.ts` as well.
- For 40 hotels the payload saving is small. The bigger win is that `filters.ts` depends on an explicit, narrow type. A change to the room schema can't break filtering by accident.

---

## 5. Filter state: the URL is the source of truth, and the same filter code runs on server and client

This was the decision that took the most iteration, and it's the one most worth reading in the code (`ScopedDiscovery`, `useHotelFilters`).

Filters (`q`, `city`, `stars`, `minPrice`, `maxPrice`, `sort`) live in the query string, so a filtered view can be shared, bookmarked, and refreshed. The flow runs in both directions:

1. The server component reads `searchParams`, parses them with `parseFilters`, and renders filtered results. The first HTML response for a shared link already contains the filtered list (section 8 covers how it streams).
2. `useHotelFilters` seeds local React state from those parsed filters. Every keystroke or slider drag updates local state and re-runs `applyFilters` in the browser. Nothing goes over the network, so it's instant.
3. After 250 ms of quiet, the URL is rewritten with `router.replace` inside a transition.
4. Back/forward and links with filters in them change the query string from outside. `useHotelFilters` diffs the server-parsed `initialFilters` against the query string it last wrote itself; a mismatch means the change came from outside and is adopted into local state in place. Its own debounced write produces exactly the query string it's expecting, so typing never fights itself. `ScopedDiscovery` still keys `HotelDiscovery` on the destination (country/state/city), so navigating to a different scope gets a genuinely fresh instance.

   An earlier version keyed `HotelDiscovery` on the full, normalised query string instead of the destination, on the theory that a settled filter change and its own echoed-back URL would always serialise to the same key. They don't: the key is read from the server's re-render, which happens *because* the debounced write landed, so every settled filter change produced a new key and silently remounted the whole subtree — losing search-input focus, resetting the globe's `hasInteracted`/view-choice state, and tearing down and recreating the WebGL context on every filter tweak. The fix moves the "was this us or something external" decision into the hook itself (compared against `lastWritten`), so the key only has to answer one question: did the destination change.

5. The debounced write doesn't go through the Next.js router at all. `useHotelFilters` calls `window.history.replaceState` directly instead of `router.replace`. They look interchangeable and aren't: `router.replace` calls into the App Router, which re-renders `ScopedDiscovery` on the server and ships a fresh RSC payload back down — a real network request, for every settled filter change, not just the first one. Since `applyFilters` already produced the filtered list locally the moment the user typed, that round trip's response was, by construction, an echo of what the client already knew. It existed purely to keep the URL bar in sync, and Next was doing far more work than that job needs.

   `window.history.replaceState` updates the URL and the back button without invoking the router, and Next's own docs carry this exact pattern — under "Linking and Navigating → Native History API" — for a client-held list that's sorted or filtered locally, where the URL only needs to stay bookmarkable. That's this app precisely: the dataset (all of a scope's hotels) is already in the browser, `applyFilters` is a synchronous pure function, and the server was never in the loop for the *filtering*, only for mirroring the answer into a URL. This also makes the "nothing goes over the network" claim in point 2 actually true; before this change it was aspirational, since the debounced echo was a real request that just happened to be invisible in the UI.

   The one thing this trades away: `router.replace`'s round trip was, incidentally, a correctness backstop. It always re-rendered the server component and always handed `HotelDiscovery` a fresh, authoritative `initialFilters` — so even a bug in the "was this us or something external" comparison in point 4 would have self-healed on the next round trip. With no round trip, that backstop is gone, and point 4's comparison is the only thing keeping local state correct on an external URL change. It's a small surface (one `useEffect`, tested), but it now has to be right on its own.

`parseFilters` treats the query string as hostile input. Unknown sort values, `stars=banana`, and inverted price ranges each fall back to that field's default without throwing. `serializeFilters` omits defaults, so a clean view has a clean URL, and the two functions are round-trip tested.

The obvious alternative was a client component reading `useSearchParams`. That version was built first and rejected. In a prerendered page, `useSearchParams` makes the nearest Suspense boundary fall back to client rendering, so the HTML for `/usa/il/chicago` contained a loading skeleton and zero hotels. Crawlers, link unfurlers, and slow connections would all have seen an empty page.

`replace` is used over `push` because dragging one slider would otherwise leave a dozen history entries and make the back button useless.

Tradeoffs:

- Filtering executes twice, once on the server and once in the browser — but, since the URL write bypasses the router, the server side of that only actually runs for a real navigation (first load, a shared link, a same-scope link, a hard refresh), not for every keystroke. The code isn't duplicated either way, but it has to stay framework-free for this to work, which is part of why section 2 matters.
- This only holds while the whole scoped catalogue fits on the client. Past a few hundred hotels the design flips: the server does indexed, paginated filtering, and the client keeps only optimistic UI state. That flip would also mean bringing `router.replace` back for the write, since at that point a filter change genuinely needs a server round trip to get the next page of results — the History API bypass in point 5 is only valid because the client can always compute the full answer locally today.
- Back/forward within one scope now preserves transient client state (an open popover, scroll position, the globe's rotation/view choice) instead of discarding it. Only a genuine destination change resets it, via the scope key — which was always the intent, but the first implementation kept that state alive for less than the length of a keystroke.
- The 250 ms debounce means a very fast copy-link right after typing could grab the previous URL.
- Bypassing the router means Next's own navigation-lifecycle plumbing doesn't see these URL changes — `useLinkStatus`, router-level pending indicators, and the Next.js DevTools navigation panel are all keyed to router-driven transitions. Nothing in this app currently reads any of that for a filter change, but a future one that wants a "navigating…" affordance during the debounce would have to build it by hand rather than getting it for free.
- Point 4's `lastWritten` comparison used to have a correctness backstop it no longer has: `router.replace`'s round trip always hit the server and always handed back an authoritative `initialFilters`, so a bug in that comparison would have self-corrected on the next write. Now that there's no round trip for the common case, the comparison has to be right on its own — it's covered by tests, but it's no longer "wrong for one render at most" if it isn't.

---

## 6. No global state library

There are three kinds of state, and each one lives where its lifetime lives.

Catalogue data is server-only and read at module load. Nothing is fetched, cached, or synchronised on the client. Swapping the seed for an API means changing `catalog.ts`.

Filters belong to one route and already persist in the URL (section 5).

Stay dates are `useState` inside `RoomAvailabilityChecker`. Nothing else reads them.

Redux, Zustand, or Pinia would add a layer of indirection here without taking any away. No state is shared across routes that the URL doesn't already carry.

Tradeoffs:

- Stay dates aren't in the URL, so a detail page link doesn't carry the dates someone checked, and refreshing resets them to the suggested stay. Putting `checkIn`/`checkOut` in the query string would be the next change if this became a booking flow.
- Once cross-route state shows up (a cart, a signed-in user, saved hotels), this reasoning no longer holds and a store or server session becomes worth having.

---

## 7. Routing: a location hierarchy, and a namespaced detail route

| Route                       | Purpose                              |
| --------------------------- | ------------------------------------ |
| `/`                         | All 40 properties                    |
| `/{country}`                | e.g. `/usa`                          |
| `/{country}/{state}`        | e.g. `/usa/il`                       |
| `/{country}/{state}/{city}` | e.g. `/usa/il/chicago`               |
| `/hotel/{id}`               | Detail view and availability checker |

Location routes are real URLs, not just a city filter. They give each destination a crawlable, titled page with breadcrumbs, and the header's Destinations menu makes them discoverable. All four levels render the same `ScopedDiscovery` component, so a location route only narrows the catalogue and then everything works like the dashboard. The city filter hides itself when the scope is already one city.

The detail route is `/hotel/{id}` and not `/{id}`. Next.js can't have two differently-named dynamic segments (`[id]` and `[country]`) at the same level. The alternatives were worse. A single `[segment]` route that checks whether the slug is a hotel id makes routing depend on data, and a future id could shadow a country. Nesting detail under the location (`/usa/il/chicago/hotel-01`) gives nice breadcrumbs, but a hotel then has no short canonical URL.

Slugs are generated from the dataset (`Ile-de-France` with its accent becomes `ile-de-france`) and never trusted from the request. An incoming segment is percent-decoded defensively, slugified, and compared against the generated values. An unknown place is a 404 with links to the real destinations. It is never an empty result list, because a typo in the URL and "no hotels match" are different failures. A real state inside the wrong country (`/france/il`) is also a 404.

Tradeoffs:

- The detail URL is one segment longer than the brief's example.
- Slug collisions aren't handled. Two cities that slugify identically inside the same state would merge. It can't happen with this seed, but a real catalogue would need stable location ids.
- Location URLs depend on the address strings in the data. Renaming a state changes its URL, and there are no redirects.

---

## 8. Rendering: dynamic location pages, static detail pages

Location routes read `searchParams`, so they render per request. The 40 detail pages have no query state, so `generateStaticParams` prerenders them at build time.

The dashboard routes sit in a `(discovery)` route group with their own `loading.tsx`, so navigating between destinations shows a results-shaped skeleton straight away. Detail pages are outside the group and never get a skeleton shaped like a list.

Tradeoffs:

- That loading boundary makes the dashboard stream. The filtered results are in the first HTML response, but inside a hidden element that React's inline script swaps in, so a client with JavaScript off sees the skeleton. Crawlers that run JavaScript and link unfurlers that read the raw markup both get the results. Removing `loading.tsx` would make the HTML fully blocking, at the cost of no feedback during client navigation.
- Every dashboard request re-runs filtering on the server. With an in-memory array of 40 records this costs almost nothing. With a real data source it would need caching keyed on the normalised query string.
- Adding a hotel to the seed needs a rebuild before its static detail page exists. That's fine for a static seed and wrong for a live inventory, where detail pages would switch to ISR or dynamic rendering.

---

## 9. Availability model

The brief says to show room types and prices "according to the dataset's `available_dates`". The field can be read more than one way, so these are the explicit choices:

- `available_dates` lists the nights a room can be booked. A stay is half-open: check in on the 10th and out on the 12th books the nights of the 10th and 11th. Checkout day is not a night.
- A room is available only if it covers every night of the stay. Partial coverage counts as unavailable. It does not quietly shorten the stay.
- Unavailable rooms stay visible in a separate section, and each one names the nights that block it ("Already booked on Fri, Jul 10, Sat, Jul 11"). A room that silently disappears from the list tells the user nothing about what to change.
- Available rooms are sorted cheapest first and show both the nightly rate and the total for the stay.
- `validateStay` returns a discriminated union (`incomplete | invalid | valid`), and the component switches on it. An incomplete range gets a neutral "Choose your stay" prompt. Only a genuinely bad range gets a destructive alert: checkout before check-in, an unparseable date, or more than 30 nights.

The 30-night cap is a guard rail. Without it, a fat-fingered year expands into hundreds of nights for every room.

Tradeoffs:

- There's no notion of quantity. `available_dates` says whether a room type is open, not how many are left. A real inventory model would need counts per night.
- Prices are flat per night. Weekend rates, taxes, and minimum-stay rules don't exist in the seed, so they don't exist here.
- `date-fns` was added for calendar arithmetic (`eachDayOfInterval`, month boundaries), because hand-rolled date code is where subtle bugs live. All dates are ISO strings with no time zone. That's correct for hotel nights and would break for anything time-of-day based.

---

## 10. The seeded dates are already in the past

Every `available_dates` value falls between 10 and 14 July 2026, which is before today. A correct booking UI would disable past dates, and then every hotel in the catalogue would show as permanently unavailable. So:

- Past dates are not disabled in the picker.
- The checker opens on dates that work. `suggestStay` finds the hotel's longest run of consecutive open nights and opens on up to two of them, so the success path shows up immediately. A fully booked hotel has no such run and falls back to the catalogue window, which is how the "No rooms available" state gets seen.
- The UI states the window the catalogue covers ("availability between Jul 10, 2026 and Jul 14, 2026"), so users aren't guessing.

Tradeoffs:

- This is shaped around the seed. With live data, `suggestStay` would be replaced by a default of tonight or the next weekend, and past dates would be disabled.
- Opening on dates the hotel can fulfil makes every hotel look more available on first view than a neutral default would. For a demo that's the right call. In a real product it could mislead.

---

## 11. Empty and error states are separate, deliberate outcomes

The full list of states and where they appear is in the README table. The main design choice is to tell apart "you filtered everything out" from "there is nothing here".

- "No hotels found matching criteria" appears only when the scope has hotels and the filters removed all of them. It comes with a Clear all filters action, because the user can fix it.
- "No properties listed in X" appears when the scope itself is empty. There's no reset button, because resetting wouldn't help.
- "No rooms available for these dates" names how many room types were checked, so it reads as a real answer and not a failure to load.
- Fully booked hotels (6 of 40, the seed's 15%) stay in the dashboard with a Fully booked badge and a slate-coloured globe pin. Hiding them would make the price and star filters look like they were wrong.
- `error.tsx` catches render failures below the root layout, so the header and navigation stay usable. `global-error.tsx` is styled inline, because when it renders, the providers and stylesheet may be what broke.

Tradeoffs:

- Complex form validation was out of scope. The only validation is on the date range, where a bad value would otherwise produce a confusing result.
- The error boundaries log to the console as a stand-in for a reporter. The UI shows the digest so a support request could be traced, but nothing is collecting it.

---

## 12. Testing strategy

Four kinds: three in Vitest with Testing Library, and one in Playwright.

- Domain unit tests cover the filter and sort combinations, query-string parsing and round-tripping, half-open date maths, stay validation, normalisation, and globe pin grouping. They are pure and fast.
- Contract tests (`catalog.test.ts`, `coordinates.test.ts`) run against the real `mock-data.json` and the real geocoding cache. They assert the facts the app depends on: 40 hotels, 10 cities with 4 each, 6 fully booked, the July window, and every hotel geocoded. If the seed or cache drifts, a test fails before the UI goes wrong.
- Component tests drive `HotelDiscovery` and `RoomAvailabilityChecker` with `user-event` and query by role and label, never by class name. They cover typing to filter, combining star ratings, both empty states, the debounced `replace` (including "replace, not push" and "one navigation per burst of typing"), and each availability outcome.
- One Playwright test (`e2e/shared-filter-link.spec.ts`) covers the seam the unit tests can only check in halves, against a production build. It fetches `/usa/il/chicago?stars=3` and asserts that the rendered markup in the first response already holds only the two 3-star hotels. Then it loads the page, types a search, checks the list and the URL (`?q=windy&stars=3`), and reloads to confirm the URL alone rebuilds the view.

The fixtures in `src/test/fixtures.ts` build hotels through the real `normalizeHotels` pipeline instead of hand-writing `Hotel` objects, so a test can't pass against a shape the app would never produce.

Tradeoffs:

- There's one e2e test, on Chromium only. The detail page, the availability checker, and back/forward re-seeding have no browser coverage.
- Text typed before hydration is dropped, so the e2e test retries its first search until the page is interactive. A real user typing that early would lose their input too.
- Next's router and `Link` are mocked in `src/test/setup.tsx`. The tests confirm the component calls `router.replace` correctly, but not what Next then does with it.
- The WebGL globe isn't rendered in tests. Its logic (`buildGlobePins`) is tested, and its pixels aren't.

---

## 13. The globe

The dashboard's right two-thirds is a 3D globe showing the currently filtered results, so narrowing the list visibly narrows the map. Clicking a pin drills in. It's a stretch feature, time-boxed to under an hour, built on Aceternity's `Globe3D` component instead of written from scratch. It's also the part with the most tradeoffs, so it gets the most words.

### Geocoding runs offline and is committed

Nominatim's usage policy allows at most one request per second and forbids bulk querying. `npm run geocode` resolves addresses once, respects the rate limit, and writes `src/data/hotel-coordinates.json`, which is committed. The app only ever reads that file, and the file is Zod-validated at load. A malformed cache degrades to "no pins", not a crash.

The seed's street addresses are fictional (`789 Skyline Blvd, Chicago` matches nothing). The script tries a structured address query, then a free-form one, then the city, and records which one it used in a `precision` field. All 40 entries ended up at `city` precision.

### Co-located hotels become one pin, and positions aren't faked

Since all four hotels in each city share one centroid, four pins there would stack invisibly. `buildGlobePins` groups hotels that match to four decimal places (about 11 m). A group is labelled `Chicago, USA · 4 hotels` and links to the city route, instead of picking one hotel arbitrarily. A hotel whose real address resolves gets its own pin and links to its detail page, so real addresses would work with no code changes.

Scattering the hotels around each city with random offsets would look better. It would also be false, so the pins stay where the data puts them.

### The vendored Aceternity component carries one patch

`src/components/ui/3d-globe.tsx` is used as installed, apart from one rendering fix. Upstream positions pin heads with drei's `<Html transform sprite>`. That mode goes through a CSS 3D matrix chain whose origin handling depends on canvas size, so on a large canvas the pin head visibly drifts off its pin. Removing `transform` makes drei project the point straight to screen pixels, the same projection the renderer uses for the pin itself, so the head can't drift at any size. The change is a few props with an explanatory comment, which keeps it easy to re-apply or drop on upgrade. Everything app-specific (colours, auto-rotate that stops on first interaction, hover labels, navigation) lives in the `HotelGlobe` wrapper.

### Loading and placement

The globe loads through `next/dynamic` with `ssr: false`, because WebGL has no server equivalent. Pin images are inline SVG data URIs, with no asset requests and no broken images. Orange means bookable and slate means fully booked. The ODbL attribution constant lives in `domain/globe.ts` and not `domain/coordinates.ts`, so rendering it doesn't pull the whole coordinate cache into the client bundle.

### WebGL is treated as optional, not assumed

A WebGL context is something the browser may decline. It can be missing (no GPU, a blocklisted driver, a hardened profile), refused after a page has lost too many contexts — Chrome's "Web page caused context loss and was blocked", which a dev server's hot reloads reach quickly — or revoked mid-session by a driver reset. Two of those three arrive as a thrown render error rather than something a hook can observe, and previously they replaced the globe with a runtime error.

So the globe is now one of two renderers behind `HotelGlobe`. Support is read with `useSyncExternalStore` (the server snapshot is "unknown", which renders a skeleton, so there's no hydration mismatch); an `ErrorBoundary` catches a canvas that throws on startup or a chunk that fails to load; and `Globe3D` reports `webglcontextlost` upwards, because a DOM event on the canvas is invisible to an error boundary. Every one of those paths lands on the same 2D map. A toggle in the corner switches between the two deliberately, and choosing the globe again remounts the canvas — a browser that refused a context a minute ago may well hand one over now.

The fallback (`hotel-map.tsx`) is hand-rolled from raster OpenStreetMap tiles over the Web Mercator maths in `domain/mercator.ts`, and reuses `buildGlobePins` unchanged, so both views plot identical pins, labels and links.

Tradeoffs:

- Hand-rolling pan, zoom and tile placement is more code than `react-leaflet` (~200 lines against a dependency). It was chosen because a fallback that ships another map library, its CSS and its own SSR caveats would cost more than the failure it covers. What it doesn't have: tile prefetching, fractional zoom, rotation, clustering.
- The fallback map does what the globe cannot on a phone, but it's still hidden below `lg` along with the globe. Showing it there is the obvious follow-up now that the small-screen cost is a few tile images rather than a WebGL context.
- OSM's public tile servers are a courtesy, with a usage policy that rules out heavy traffic. A production deployment would point `tileUrl` at its own or a paid tile host.
- A probe costs one throwaway context, so `isWebGLAvailable` caches its answer for the page. If the browser's mood changes between the probe and the canvas, the error boundary is what catches it.
- `three`, `@react-three/fiber`, and `drei` are by far the heaviest dependencies in the app. The globe is hidden below `lg` because a phone has no room for it and shouldn't pay for a WebGL context. A list/map toggle on small screens would be the follow-up.
- The Earth textures load from unpkg at runtime (the component's defaults). That's a third-party network dependency on a feature that is otherwise self-contained. Production would self-host them.
- The canvas conveys nothing to assistive technology. A text overlay summarises what's plotted ("12 properties across 3 locations"), and the results list remains the accessible way to reach every hotel.
- Committed coordinates can drift from the seed. The contract test fails if any hotel is missing a position.

---

## 14. Desktop layout: the page doesn't scroll, the results list does

On `lg` and up the dashboard fills exactly one viewport. Filters sit in a card at the top of the left column, results scroll in their own area beneath them, and the globe takes the rest. The root layout uses `has-[[data-viewport-fill]]` to constrain height only on pages that opt in, so detail pages scroll normally.

Because the page itself can't scroll, a mouse wheel over the filters or the header would do nothing. `useForwardWheelToResults` forwards those wheel events to the results list, but skips the globe (where wheel zooms), anything that can scroll natively (open popovers), and ctrl+wheel (browser zoom). The results container is widened by exactly the themed scrollbar's width, so the scrollbar sits in the grid gap and the card edges line up with the filter card.

Below `lg`, the layout is an ordinary scrolling page, and the filters move into a slide-over sheet whose trigger shows the active filter count.

Tradeoffs:

- Intercepting wheel events at the window level is the kind of thing that surprises the next maintainer. It is scoped behind a media query and covered by explicit exclusions, but it's still global behaviour in a component file.
- Pixel-precise scrollbar compensation depends on a CSS custom property matching the scrollbar width in `globals.css`. Changing one without the other misaligns the columns.
- Keyboard page scrolling (Page Down with focus outside the list) isn't forwarded.

---

## 15. Tooling decisions

- `typedRoutes` is off. Almost every link is a template literal built from data, which typed routes can't narrow without a cast at every call site.
- ESLint 10 uses `@next/eslint-plugin-next` directly, alongside `typescript-eslint` and `eslint-plugin-react-hooks`. `eslint-config-next` is the default, but it bundles `eslint-plugin-react`, which crashes on ESLint 10 (checked against 16.3.5 and the 16.4 canary). Using the plugin directly is the setup Next documents for this case. The other option was ESLint 9, which is now deprecated.
- `@react-three/fiber` 9.7 declares React `<19.3` as a peer, and the app runs React 19.3. A scoped `overrides` entry in `package.json` covers that one package. A repo-wide `legacy-peer-deps` would also silence every other peer check, and it did: `@testing-library/dom` was never installed and the whole test suite failed to load.
- The same fiber/three drift shows up as a harmless console warning: fiber 9.7 still constructs `THREE.Clock`, which three 0.186 has deprecated in favour of `THREE.Timer`. Nothing in the app calls `Clock` directly, so there's nothing to fix here — it resolves whenever fiber updates.
- Vitest resolves the `@/*` alias from `tsconfig.json` through Vite's built-in `resolve.tsconfigPaths`, so the alias lives in one place.
- The shadcn `base-lyra` style (Base UI primitives) generates several components that call `useRender` without `"use client"`. That works under Vite and fails in a Server Component, so the directive was added to those files. Phosphor icons come from the `dist/ssr` build, which renders in both environments.
- `ThemeScript` applies the stored theme before first paint, so dark-mode users don't see a light flash on load.

Tradeoffs:

- Editing generated shadcn files means re-running `shadcn add` can undo the change.
- Going without `eslint-config-next` drops its `eslint-plugin-react` and `jsx-a11y` rules. Once that config supports ESLint 10, switching back is a two-line change.
- The fiber override tells npm to trust React 19.3 before fiber's maintainers do. The globe renders and builds on it, but it's worth removing once fiber widens its peer range.

---

## 16. Assumptions about the data

These aren't architecture, but several decisions above depend on them.

- All prices are USD. The seed has no currency field and spans six countries. The footer states this so a Tokyo rate isn't silently read as dollars. A real model needs a currency per property.
- `star_rating` is the official 1 to 5 classification and `overall_rating` is the guest score. They're displayed differently (star icons against a numeric badge with review count) so they can't be confused.
- A hotel's price for filtering and for the "from" price on cards is its cheapest room.
- There is no booking step. The brief is about discovery, so the app stops once it has shown availability and price.

---

## Deliberately left out

- Date filtering on the dashboard ("hotels available on these dates"). The brief puts availability on the detail view. `getHotelAvailability` already supports it, so this would mostly be UI work.
- Pagination and virtualisation. 40 cards render instantly. The threshold for revisiting section 5 is a few hundred.
- Images. The seed has none, and placeholder boxes add visual noise without information, so cards lead with rating and price instead.
- The globe on mobile, and camera fly-to on selection.
- Authentication, persistence, and a booking flow.
- `import "server-only"` on the catalogue. It holds public data and no secrets, and leaving it environment-agnostic is what lets the contract tests import it directly. A module that touched credentials would be marked.
