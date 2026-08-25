import { useCategories } from '@/hooks/useCategories'

/**
 * One source of truth for the site's primary navigation.
 *
 * The desktop bar, the Shop mega menu, the mobile drawer and the footer all
 * read from here. Before this, the desktop bar held a hard-coded list of the
 * five original categories, the mega menu read the database and the mobile
 * drawer read a bundled file — so adding a category updated one surface,
 * deleting one updated none of them, and the three could disagree.
 *
 * A category reaches the navigation when it is active (not hidden or deleted)
 * and has `showInNav` on.
 */

/** Links that are not categories and are always present, in display order. */
export const STATIC_NAV = [
  { label: 'Offers', to: '/shop?filter=sale', tone: 'sale' },
]

/**
 * Turns a category record into a nav item.
 *
 * `/shop/:slug` is a real route that filters the shop by that category, so the
 * navigation needs no separate page per category — which is what keeps a
 * category the admin invents five minutes from now working immediately.
 */
const toNavItem = (category) => ({
  key: category.slug,
  label: category.name,
  to: `/shop/${category.slug}`,
  subcategories: (category.subcategories ?? []).map((sub) => ({
    label: sub,
    // `?sub=` pre-ticks that type in the shop's filter panel.
    to: `/shop/${category.slug}?sub=${encodeURIComponent(sub)}`,
  })),
})

/**
 * The categories in the top navigation, already shaped as links.
 *
 * `showInNav !== false` rather than `=== true`: categories created before the
 * flag existed have no value for it, and those should keep appearing rather
 * than the header silently emptying itself on upgrade.
 */
export function useNavItems() {
  return useCategories()
    .filter((c) => c.active !== false && c.showInNav !== false)
    .map(toNavItem)
}
