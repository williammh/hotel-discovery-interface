import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import type { LocationScope } from "@/domain/catalog"

type Crumb = { label: string; href: string }

export function scopeCrumbs(scope: LocationScope | null): Crumb[] {
  const crumbs: Crumb[] = [{ label: "All destinations", href: "/" }]

  if (!scope) {
    return crumbs
  }

  crumbs.push({ label: scope.country.label, href: `/${scope.country.slug}` })

  if (scope.state) {
    crumbs.push({
      label: scope.state.label,
      href: `/${scope.country.slug}/${scope.state.slug}`,
    })
  }

  if (scope.state && scope.city) {
    crumbs.push({
      label: scope.city.label,
      href: `/${scope.country.slug}/${scope.state.slug}/${scope.city.slug}`,
    })
  }

  return crumbs
}

export function LocationBreadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1

          return (
            <BreadcrumbItem key={crumb.href}>
              {isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
