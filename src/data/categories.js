/**
 * Storefront taxonomy. `slug` drives the /shop/:category route.
 */
export const CATEGORIES = [
  {
    slug: 'hijabs',
    name: 'Hijabs',
    tagline: 'Drape that holds all day',
    blurb:
      'Breathable georgette, buttery jersey and premium chiffon — cut generously, hemmed by hand, and colour-matched season after season.',
    art: { shape: 'hijab', hue: 320 },
    subcategories: [
      'Georgette Hijab',
      'Jersey Hijab',
      'Chiffon Hijab',
      'Instant Hijab',
      'Cotton Voile',
      'Inner Cap & Pins',
    ],
  },
  {
    slug: 'skincare',
    name: 'Skin Care',
    tagline: 'Barrier-first, fragrance-light',
    blurb:
      'Gentle actives formulated for humid weather — cleanse, hydrate and protect without stripping your skin barrier.',
    art: { shape: 'dropper', hue: 30 },
    subcategories: ['Cleanser', 'Toner', 'Serum', 'Moisturiser', 'Sunscreen', 'Mask & Lip Care'],
  },
  {
    slug: 'cosmetics',
    name: 'Cosmetics',
    tagline: 'Everyday colour, wedding-day payoff',
    blurb:
      'Long-wear formulas built for Dhaka humidity, in shades chosen for South Asian skin tones.',
    art: { shape: 'lipstick', hue: 350 },
    subcategories: ['Lips', 'Face', 'Eyes', 'Brushes & Tools', 'Gift Sets'],
  },
  {
    slug: 'hair-care',
    name: 'Hair Care',
    tagline: 'For hair that lives under a scarf',
    blurb:
      'Scalp-focused oils, sulphate-free washes and lightweight serums that keep length healthy under daily wrapping.',
    art: { shape: 'bottle', hue: 150 },
    subcategories: ['Hair Oil', 'Shampoo', 'Conditioner', 'Hair Serum', 'Hair Mask', 'Accessories'],
  },
  {
    slug: 'others',
    name: 'Others',
    tagline: 'The finishing touches',
    blurb:
      'Attar, prayer essentials, everyday jewellery and gift-ready bundles — the small things that complete the look.',
    art: { shape: 'pouch', hue: 265 },
    subcategories: ['Attar & Perfume', 'Bags & Pouches', 'Jewellery', 'Prayer Essentials', 'Gift Sets'],
  },
]

export const getCategory = (slug) => CATEGORIES.find((c) => c.slug === slug)
