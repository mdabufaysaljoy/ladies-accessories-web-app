import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Button, IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Drawer } from '@/components/ui/Overlay'
import { EmptyState, PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useCategories } from '@/hooks/useCategories'
import { useFacets, useProducts } from '@/hooks/useCatalog'
import { cx, taka } from '@/utils/format'

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'new', label: 'Newest' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'rating', label: 'Top rated' },
  { id: 'discount', label: 'Biggest saving' },
]


function FilterGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-ink/10 py-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[0.875rem] font-semibold tracking-tight">{title}</span>
        <Icon
          name="chevronDown"
          size={16}
          className={cx('text-ink/40 transition-transform duration-300', open && 'rotate-180')}
        />
      </button>
      <div
        className={cx(
          'grid transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
          open ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

function Checkbox({ checked, onChange, label, count }) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 py-1.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cx(
          'grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[0.3rem] border transition-all duration-200',
          checked ? 'border-ink bg-ink text-cream' : 'border-ink/25 group-hover:border-ink/50',
        )}
      >
        {checked && <Icon name="check" size={12} strokeWidth={3} />}
      </span>
      <span className="flex-1 text-[0.875rem] text-ink/75 group-hover:text-ink">{label}</span>
      {count != null && <span className="text-[0.75rem] text-ink/35">{count}</span>}
    </label>
  )
}

function FilterPanel({ state, set, categorySlug, resultCount, facets, categories, bounds }) {
  const subcategories = facets?.subcategories ?? []

  const toggleArray = (key, value) =>
    set((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
    }))

  return (
    <div>
      {!categorySlug && (
        <FilterGroup title="Category">
          {categories.map((c) => (
            <Checkbox
              key={c.slug}
              label={c.name}
              count={c.productCount}
              checked={state.categories.includes(c.slug)}
              onChange={() => toggleArray('categories', c.slug)}
            />
          ))}
        </FilterGroup>
      )}

      {subcategories.length > 0 && (
        <FilterGroup title="Type">
          {subcategories.map((sub) => (
            <Checkbox
              key={sub.value}
              label={sub.value}
              count={sub.count}
              checked={state.subs.includes(sub.value)}
              onChange={() => toggleArray('subs', sub.value)}
            />
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="Price">
        <div className="px-1">
          <div className="flex items-center justify-between text-[0.8125rem] text-ink/60">
            <span>{taka(bounds.min)}</span>
            <span className="font-semibold text-ink">Up to {taka(state.maxPrice ?? bounds.max)}</span>
          </div>
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={50}
            value={state.maxPrice ?? bounds.max}
            onChange={(e) => set((s) => ({ ...s, maxPrice: Number(e.target.value) }))}
            aria-label="Maximum price"
            className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink/12 accent-plum"
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Availability">
        <Checkbox
          label="In stock only"
          checked={state.inStock}
          onChange={() => set((s) => ({ ...s, inStock: !s.inStock }))}
        />
        <Checkbox
          label="On offer"
          checked={state.onSale}
          onChange={() => set((s) => ({ ...s, onSale: !s.onSale }))}
        />
      </FilterGroup>

      <p className="pt-5 text-[0.8125rem] text-ink/50">
        Showing <strong className="font-semibold text-ink">{resultCount}</strong> products
      </p>
    </div>
  )
}

const emptyFilters = {
  categories: [],
  subs: [],
  maxPrice: null,
  inStock: false,
  onSale: false,
}

export default function Shop() {
  const { category: categorySlug } = useParams()
  const [params, setParams] = useSearchParams()
  const categories = useCategories()
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null

  const query = params.get('q') ?? ''
  const preset = params.get('filter')
  const presetSub = params.get('sub')

  const [filters, setFilters] = useState(emptyFilters)
  const [sort, setSort] = useState('featured')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [page, setPage] = useState(1)

  const facets = useFacets(categorySlug)
  const bounds = facets?.priceRange ?? { min: 0, max: 5000 }

  // A `?sub=` link from the mega menu should pre-tick that type.
  useEffect(() => {
    setFilters({ ...emptyFilters, subs: presetSub ? [presetSub] : [] })
    setPage(1)
  }, [categorySlug, presetSub])

  usePageMeta(
    category ? category.name : query ? `Search: ${query}` : 'Shop all',
    category?.blurb ?? 'Browse every hijab, skincare, cosmetic and hair care product at Goods by Sadia.',
  )

  /**
   * Filtering happens on the server so the shop always reflects live stock and
   * admin edits. Multi-select category/type is applied client-side on the page
   * we already have, because the API takes one value per field.
   */
  const apiParams = useMemo(
    () => ({
      category: categorySlug ?? (filters.categories.length === 1 ? filters.categories[0] : undefined),
      subcategory: filters.subs.length === 1 ? filters.subs[0] : undefined,
      q: query || undefined,
      tag: preset === 'gift' ? 'gift' : undefined,
      maxPrice: filters.maxPrice ?? undefined,
      inStock: filters.inStock ? 'true' : undefined,
      sort,
      page,
      limit: 24,
    }),
    [categorySlug, filters, query, preset, sort, page],
  )

  const { products: fetched, meta, loading } = useProducts(apiParams)

  const products = useMemo(() => {
    let list = fetched
    if (!categorySlug && filters.categories.length > 1) {
      list = list.filter((p) => filters.categories.includes(p.category))
    }
    if (filters.subs.length > 1) list = list.filter((p) => filters.subs.includes(p.subcategory))
    if (filters.onSale || preset === 'sale') list = list.filter((p) => p.compareAt > p.price)
    return list
  }, [fetched, categorySlug, filters, preset])

  const activeCount =
    filters.categories.length +
    filters.subs.length +
    (filters.inStock ? 1 : 0) +
    (filters.onSale ? 1 : 0) +
    (filters.maxPrice != null && filters.maxPrice < bounds.max ? 1 : 0)

  const clearAll = () => {
    setFilters(emptyFilters)
    setParams({}, { replace: true })
    setPage(1)
  }

  const heading = category
    ? category.name
    : preset === 'sale'
      ? 'Offers & sale'
      : preset === 'gift'
        ? 'Gift sets'
        : query
          ? `Results for \u201C${query}\u201D`
          : 'All products'

  const panelProps = {
    state: filters,
    set: (updater) => { setFilters(updater); setPage(1) },
    categorySlug,
    resultCount: products.length,
    facets,
    categories,
    bounds,
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Shop', to: '/shop' }, ...(category ? [{ label: category.name }] : [])]}
        eyebrow={category ? category.tagline : 'The full catalogue'}
        title={heading}
        lead={
          category?.blurb ??
          (preset === 'sale'
            ? 'Reduced while stocks last — no inflated original prices, just real discounts.'
            : 'Every product we stock, in one place. Filter by type, price or rating.')
        }
      >
        {/* category pills */}
        <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1">
          <Link
            to="/shop"
            className={cx(
              'shrink-0 rounded-full px-4 py-2 text-[0.8125rem] font-medium transition-colors',
              !categorySlug ? 'bg-ink text-cream' : 'border border-ink/15 hover:border-ink',
            )}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/shop/${c.slug}`}
              className={cx(
                'shrink-0 rounded-full px-4 py-2 text-[0.8125rem] font-medium transition-colors',
                categorySlug === c.slug ? 'bg-ink text-cream' : 'border border-ink/15 hover:border-ink',
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="container-x py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
          {/* desktop filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-36">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg">Filters</h2>
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[0.75rem] font-medium text-plum underline underline-offset-2"
                  >
                    Clear all ({activeCount})
                  </button>
                )}
              </div>
              <div className="mt-2 max-h-[calc(100dvh-13rem)] overflow-y-auto pr-1">
                <FilterPanel {...panelProps} />
              </div>
            </div>
          </aside>

          <div>
            {/* toolbar */}
            <div className="mb-8 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setDrawerOpen(true)}
                >
                  <Icon name="filter" size={16} />
                  Filters
                  {activeCount > 0 && (
                    <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[0.625rem] text-cream">
                      {activeCount}
                    </span>
                  )}
                </Button>
                <p className="hidden text-[0.875rem] text-ink/55 sm:block">
                  {meta?.total ?? products.length} {(meta?.total ?? products.length) === 1 ? 'product' : 'products'}
                </p>
              </div>

              <label className="flex items-center gap-2 text-[0.8125rem] text-ink/55">
                <span className="hidden sm:inline">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setPage(1) }}
                  aria-label="Sort products"
                  className="cursor-pointer rounded-full border border-ink/15 bg-cream py-2 pl-3.5 pr-8 text-[0.8125rem] text-ink outline-none transition-colors hover:border-ink/40 focus:border-ink"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* active chips */}
            {(activeCount > 0 || query || preset) && (
              <div className="mb-7 flex flex-wrap items-center gap-2">
                {query && (
                  <Chip label={`\u201C${query}\u201D`} onRemove={() => setParams({}, { replace: true })} />
                )}
                {preset && (
                  <Chip
                    label={preset === 'sale' ? 'On offer' : 'Gift sets'}
                    onRemove={() => setParams({}, { replace: true })}
                  />
                )}
                {filters.subs.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    onRemove={() => setFilters((f) => ({ ...f, subs: f.subs.filter((x) => x !== s) }))}
                  />
                ))}
                {filters.categories.map((c) => (
                  <Chip
                    key={c}
                    label={categories.find((x) => x.slug === c)?.name ?? c}
                    onRemove={() => setFilters((f) => ({ ...f, categories: f.categories.filter((x) => x !== c) }))}
                  />
                ))}
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[0.75rem] font-medium text-plum underline underline-offset-2"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {loading && products.length === 0 ? (
              <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i}>
                    <div className="skeleton aspect-[4/5] rounded-card" />
                    <div className="skeleton mt-4 h-3 w-1/3 rounded" />
                    <div className="skeleton mt-2 h-4 w-3/4 rounded" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                icon="search"
                title="Nothing matches those filters"
                body="Try widening the price range or clearing a filter or two."
                action="Clear all filters"
                onAction={clearAll}
              />
            ) : (
              <>
                <ProductGrid products={products} columns="sm:grid-cols-2 xl:grid-cols-3" />

                {meta && meta.pages > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page <= 1}
                      onClick={() => { setPage(meta.page - 1); window.scrollTo({ top: 0 }) }}
                    >
                      <Icon name="chevronLeft" size={15} /> Previous
                    </Button>
                    <span className="text-[0.8125rem] text-ink/55">
                      Page {meta.page} of {meta.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page >= meta.pages}
                      onClick={() => { setPage(meta.page + 1); window.scrollTo({ top: 0 }) }}
                    >
                      Next <Icon name="chevronRight" size={15} />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* mobile filter drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        side="left"
        width="max-w-sm"
        footer={
          <div className="flex gap-2.5 p-5">
            <Button variant="outline" full onClick={clearAll}>
              Clear all
            </Button>
            <Button full onClick={() => setDrawerOpen(false)}>
              Show {products.length} results
            </Button>
          </div>
        }
      >
        <div className="px-5">
          <FilterPanel {...panelProps} />
        </div>
      </Drawer>
    </>
  )
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sand py-1.5 pl-3.5 pr-2 text-[0.75rem]">
      {label}
      <IconButton
        label={`Remove ${label}`}
        onClick={onRemove}
        className="h-5 w-5 text-ink/45 hover:bg-ink/10"
      >
        <Icon name="close" size={12} />
      </IconButton>
    </span>
  )
}
