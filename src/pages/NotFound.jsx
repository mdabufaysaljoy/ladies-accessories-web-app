import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { usePageMeta } from '@/components/common/PageShell'
import { CATEGORIES } from '@/data/categories'

export default function NotFound() {
  usePageMeta('Page not found')

  return (
    <div className="container-x flex min-h-[65vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-[7rem] leading-none text-plum/15 md:text-[10rem]">404</p>
      <h1 className="-mt-6 text-[2rem] leading-tight md:text-[2.75rem]">
        We could not find that page
      </h1>
      <p className="mt-4 max-w-md text-[1.0625rem] text-ink/60 text-balance-pretty">
        The link may be old, or the product may have sold out and been retired. Try one of these instead.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Button to="/" size="lg">
          Back to home
        </Button>
        <Button to="/shop" variant="outline" size="lg">
          Browse all products
        </Button>
      </div>

      <div className="mt-14 w-full max-w-2xl border-t border-ink/10 pt-9">
        <p className="eyebrow text-ink/40">Or jump to a category</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to={`/shop/${c.slug}`}
              className="group inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-[0.875rem] transition-colors hover:border-ink hover:bg-ink hover:text-cream"
            >
              {c.name}
              <Icon
                name="arrowRight"
                size={14}
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
