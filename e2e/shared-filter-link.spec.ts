import { expect, test } from "@playwright/test"

const CHICAGO_THREE_STAR = "/usa/il/chicago?stars=3"

/** Hotel names rendered in the results section of a raw HTML response. */
function renderedResultNames(html: string): string[] {
  const start = html.indexOf('aria-label="Hotel results"')
  const section = html.slice(start, html.indexOf("</section>", start))
  return [...section.matchAll(/href="\/hotel\/[^"]+"[^>]*>([^<]+)</g)].map(
    ([, name]) => name
  )
}

test("a shared filtered link is server-rendered and stays in sync as the user filters", async ({
  page,
  request,
}) => {
  // The payload for client-side filtering holds every Chicago hotel, so check
  // the rendered markup: the first response must already be filtered.
  const response = await request.get(CHICAGO_THREE_STAR)
  expect(renderedResultNames(await response.text())).toEqual([
    "Magnolia Place Chicago",
    "Windy City Suites",
  ])

  await page.goto(CHICAGO_THREE_STAR)
  const results = page.getByRole("region", { name: "Hotel results" })
  await expect(results.getByRole("link")).toHaveText([
    "Magnolia Place Chicago",
    "Windy City Suites",
  ])

  // The markup is visible before hydration, and input typed before then is dropped.
  await expect(async () => {
    await page.getByLabel("Search").fill("windy")
    await expect(results.getByRole("link")).toHaveText(["Windy City Suites"], {
      timeout: 1_000,
    })
  }).toPass()
  await expect(page).toHaveURL(/\/usa\/il\/chicago\?q=windy&stars=3$/)

  // A reload rebuilds the view from the URL alone.
  await page.reload()
  await expect(page.getByLabel("Search")).toHaveValue("windy")
  await expect(results.getByRole("link")).toHaveText(["Windy City Suites"])
})
