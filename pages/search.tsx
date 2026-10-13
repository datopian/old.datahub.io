import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DebouncedInput from '../components/ui/DebouncedInput'
import { provider } from '../lib/providers'
import Seo from '../components/Seo'
import { SITE_NAME } from '../lib/site'

// The catalog total is baked in at build time; everything else on this page runs in
// the browser against the static Pagefind index (built from out/ by `npm run
// postbuild`). Nothing here calls CKAN, so search costs nothing per visitor and works on
// any static host.
export async function getStaticProps() {
  return { props: { total: (await provider.listDatasets()).length } }
}

type FilterKey = 'publisher' | 'format' | 'tag' | 'license'
type Filters = Partial<Record<FilterKey | 'org', string[]>>
type FilterCounts = Record<string, Record<string, number>>
type ResultCard = { url: string; title: string; publisher?: string; updated?: string; excerpt: string }

type PagefindResult = {
  id: string
  data: () => Promise<{ url: string; excerpt: string; meta: Record<string, string> }>
}
type PagefindSearch = { results: PagefindResult[]; filters: FilterCounts }
type Pagefind = {
  options: (o: Record<string, unknown>) => Promise<void>
  init: () => Promise<void>
  filters: () => Promise<FilterCounts>
  search: (q: string | null, o?: Record<string, unknown>) => Promise<PagefindSearch>
}

const PAGE_SIZE = 20
const FACETS: { key: FilterKey; label: string; limit: number }[] = [
  { key: 'publisher', label: 'Publisher', limit: 12 },
  { key: 'format', label: 'Format', limit: 12 },
  { key: 'tag', label: 'Tag', limit: 16 },
  { key: 'license', label: 'License', limit: 8 },
]
// URL params the page reads (the old-CKAN redirects in worker/ produce these).
const PARAMS: Record<string, keyof Filters> = {
  publisher: 'publisher',
  format: 'format',
  tag: 'tag',
  license: 'license',
  org: 'org',
}

// Load the Pagefind runtime from the exported site. A plain dynamic import would make
// the bundler try to resolve it at build time; this keeps it a runtime URL.
let pagefindPromise: Promise<Pagefind | null> | null = null
function loadPagefind(): Promise<Pagefind | null> {
  if (!pagefindPromise) {
    const importer = new Function('u', 'return import(u)') as (u: string) => Promise<Pagefind>
    pagefindPromise = importer('/pagefind/pagefind.js')
      .then(async (pf) => {
        await pf.options({ excerptLength: 30 })
        await pf.init()
        // Load the filter index once; without it, search() returns no facet counts.
        await pf.filters()
        return pf
      })
      .catch(() => null)
  }
  return pagefindPromise
}

function readList(v: string | string[] | undefined): string[] {
  if (!v) return []
  return (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean)
}

// Catalog surface: a borderless search line over a faceted result list, all served
// from the static Pagefind index (chunked — a query loads only the shards it needs).
export default function Search({ total }: { total: number }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>({})
  const [page, setPage] = useState(1)
  const [ready, setReady] = useState<'loading' | 'ok' | 'missing'>('loading')
  const [counts, setCounts] = useState<FilterCounts>({})
  const [results, setResults] = useState<PagefindResult[]>([])
  const [cards, setCards] = useState<ResultCard[]>([])
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const seq = useRef(0)

  // Initialise query + filters from the URL once the router is ready.
  useEffect(() => {
    if (!router.isReady) return
    const q = router.query.q
    setQuery(typeof q === 'string' ? q : '')
    const f: Filters = {}
    for (const [param, key] of Object.entries(PARAMS)) {
      const vals = readList(router.query[param])
      if (vals.length) f[key] = vals
    }
    setFilters(f)
    const p = Number(router.query.page)
    setPage(Number.isFinite(p) && p > 0 ? p : 1)
  }, [router.isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPagefind().then((pf) => setReady(pf ? 'ok' : 'missing'))
  }, [])

  // Keep the URL shareable: ?q=…&publisher=…&page=…
  const syncUrl = useCallback(
    (q: string, f: Filters, p: number) => {
      const qs: Record<string, string> = {}
      if (q.trim()) qs.q = q.trim()
      for (const [k, v] of Object.entries(f)) if (v && v.length) qs[k] = v.join(',')
      if (p > 1) qs.page = String(p)
      router.replace({ pathname: '/search', query: qs }, undefined, { shallow: true })
    },
    [router]
  )

  // Run the search whenever the query or filters change.
  useEffect(() => {
    if (ready !== 'ok' || !router.isReady) return
    const mine = ++seq.current
    setSearching(true)
    ;(async () => {
      const pf = await loadPagefind()
      if (!pf) return
      const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v.length))
      const q = query.trim()
      const search = await pf.search(q || null, {
        filters: active,
        // Browsing (no query) lists the most recently updated datasets first.
        ...(q ? {} : { sort: { modified: 'desc' } }),
      })
      if (mine !== seq.current) return
      setResults(search.results)
      setCounts(search.filters ?? {})
      setSearching(false)
    })()
  }, [query, filters, ready, router.isReady])

  // Fetch fragment data only for the visible page of results.
  useEffect(() => {
    let cancelled = false
    const slice = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    Promise.all(slice.map((r) => r.data())).then((data) => {
      if (cancelled) return
      setCards(
        data.map((d) => ({
          url: d.url.replace(/index\.html$/, '').replace(/\.html$/, ''),
          title: d.meta.title || d.url,
          publisher: d.meta.publisher,
          updated: d.meta.updated,
          excerpt: d.excerpt,
        }))
      )
    })
    return () => {
      cancelled = true
    }
  }, [results, page])

  const onQuery = (q: string) => {
    if (q === query) return
    setQuery(q)
    setPage(1)
    syncUrl(q, filters, 1)
  }

  const toggle = (key: FilterKey, value: string) => {
    const cur = new Set(filters[key] ?? [])
    if (cur.has(value)) cur.delete(value)
    else cur.add(value)
    const next = { ...filters, [key]: Array.from(cur) }
    setFilters(next)
    setPage(1)
    syncUrl(query, next, 1)
  }

  const clearAll = () => {
    setFilters({})
    setPage(1)
    syncUrl(query, {}, 1)
  }

  const goPage = (p: number) => {
    setPage(p)
    syncUrl(query, filters, p)
    window.scrollTo({ top: 0 })
  }

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const activeCount = Object.values(filters).reduce((n, v) => n + (v?.length ?? 0), 0)
  const facetValues = useMemo(() => {
    const out: Record<string, [string, number][]> = {}
    for (const { key } of FACETS) {
      const selected = new Set(filters[key] ?? [])
      const entries = Object.entries(counts[key] ?? {}).filter(([v, n]) => n > 0 || selected.has(v))
      out[key] = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    }
    return out
  }, [counts, filters])

  return (
    <>
      {/* Result pages are near-duplicates with endless query/filter combinations: keep
          them out of the index, but let crawlers follow their links. */}
      <Seo title={`Search datasets — ${SITE_NAME}`} path="/search/" noindex />
      <main className="mx-auto max-w-6xl px-6 pb-24 sm:px-16">
        <nav className="pt-7 font-sans text-[13px] font-medium text-ink/50">
          <Link href="/" className="text-inherit no-underline hover:text-accent">
            Home
          </Link>{' '}
          <span className="text-ink">/ Search</span>
        </nav>

        <header className="pb-8 pt-8">
          <h1 className="mb-6 font-serif text-[40px] font-semibold leading-tight text-ink">Datasets</h1>
          <DebouncedInput
            type="search"
            value={query}
            onChange={(v) => onQuery(String(v))}
            debounce={250}
            placeholder={`Search ${total.toLocaleString('en-US')} datasets…`}
            aria-label="Search datasets"
            className="w-full border-0 border-b border-ink/30 bg-transparent pb-3.5 font-serif text-lg italic text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none"
          />
        </header>

        {ready === 'missing' ? (
          <div className="border-2 border-dashed border-ink/20 p-12 text-center font-sans text-sm text-ink/50">
            The search index isn&apos;t built yet. Run <code>npm run build</code> (it runs Pagefind over the
            export in <code>out/</code>), then serve <code>out/</code>.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr] lg:gap-14">
            <aside className="flex flex-col gap-8">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="self-start font-sans text-xs font-semibold uppercase tracking-[0.06em] text-accent hover:text-ink"
                >
                  Clear filters ({activeCount})
                </button>
              )}
              {filters.org && filters.org.length > 0 && (
                <div className="font-sans text-xs text-ink/60">
                  Organization: <strong>{filters.org.join(', ')}</strong>
                </div>
              )}
              {FACETS.map(({ key, label, limit }) => {
                const values = facetValues[key] ?? []
                if (values.length === 0) return null
                const shown = expanded[key] ? values : values.slice(0, limit)
                const selected = new Set(filters[key] ?? [])
                return (
                  <div key={key}>
                    <div className="mb-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/45">
                      {label}
                    </div>
                    <ul className="flex flex-col gap-1">
                      {shown.map(([value, n]) => (
                        <li key={value}>
                          <button
                            type="button"
                            onClick={() => toggle(key, value)}
                            className={`flex w-full items-baseline justify-between gap-3 text-left font-sans text-[13px] ${
                              selected.has(value) ? 'font-semibold text-accent' : 'text-ink/75 hover:text-accent'
                            }`}
                          >
                            <span className="min-w-0 truncate">{value}</span>
                            <span className="flex-shrink-0 text-[11px] text-ink/40">{n.toLocaleString('en-US')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {values.length > limit && (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
                        className="mt-2 font-sans text-[11px] font-medium text-ink/50 underline underline-offset-2 hover:text-accent"
                      >
                        {expanded[key] ? 'Show fewer' : `Show all ${values.length}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </aside>

            <section className="min-w-0">
              <p className="mb-5 font-sans text-xs text-ink/45">
                {ready === 'loading' || searching
                  ? 'Searching…'
                  : `${results.length.toLocaleString('en-US')} dataset${results.length === 1 ? '' : 's'}`}
              </p>
              {ready === 'ok' && !searching && results.length === 0 ? (
                <div className="border-2 border-dashed border-ink/20 p-12 text-center font-serif text-lg italic text-ink/50">
                  No datasets match.
                </div>
              ) : (
                <ol className="flex flex-col">
                  {cards.map((c) => (
                    <li key={c.url} className="border-b border-dotted border-ink/25 py-5">
                      <Link href={c.url} className="group block no-underline">
                        <h2 className="font-serif text-[21px] font-semibold leading-snug text-ink group-hover:text-accent">
                          {c.title}
                        </h2>
                        <div className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/45">
                          {c.publisher}
                          {c.updated ? ` · updated ${c.updated}` : ''}
                        </div>
                        {c.excerpt && (
                          <p
                            className="mt-2 line-clamp-3 font-serif text-[15px] leading-relaxed text-ink/70 [&_mark]:bg-accent/15 [&_mark]:text-ink"
                            // Pagefind excerpts are escaped text with <mark> highlights.
                            dangerouslySetInnerHTML={{ __html: c.excerpt }}
                          />
                        )}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}

              {pages > 1 && (
                <nav className="mt-8 flex items-center justify-between font-sans text-xs" aria-label="Pagination">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => goPage(page - 1)}
                    className="font-semibold uppercase tracking-[0.06em] text-accent disabled:text-ink/25"
                  >
                    &larr; Previous
                  </button>
                  <span className="text-ink/50">
                    Page {page} of {pages.toLocaleString('en-US')}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => goPage(page + 1)}
                    className="font-semibold uppercase tracking-[0.06em] text-accent disabled:text-ink/25"
                  >
                    Next &rarr;
                  </button>
                </nav>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  )
}
