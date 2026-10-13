// Writes public/sitemap.xml from the CKAN snapshot (.cache/catalog.json): the home page,
// the publisher index and publisher pages, and every dataset page with its lastmod.
// Run after fetch:catalog (prebuild); `next build` copies it into out/.
// Also writes .cache/urls.txt, the full URL list used by scripts/indexnow.ts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLISHER_PAGE_SIZE } from '../lib/publishers'
import { absoluteUrl, publisherHref } from '../lib/site'

type Row = { slug: string; namespace: string; modified?: string }

const root = join(__dirname, '..')
const { datasets, fetchedAt } = JSON.parse(readFileSync(join(root, '.cache', 'catalog.json'), 'utf8')) as {
  datasets: Row[]
  fetchedAt: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const day = (iso?: string) => (iso ? iso.slice(0, 10) : undefined)
const entries: { loc: string; lastmod?: string }[] = []

// Newest data across the catalog dates the home page and publisher index.
const newest = datasets.reduce((m, d) => ((d.modified ?? '') > m ? d.modified ?? '' : m), '')
entries.push({ loc: absoluteUrl('/'), lastmod: day(newest) }, { loc: absoluteUrl('/publishers/'), lastmod: day(newest) })

const byNs = new Map<string, Row[]>()
for (const d of datasets) byNs.set(d.namespace, [...(byNs.get(d.namespace) ?? []), d])
byNs.forEach((list, ns) => {
  const latest = list.reduce((m, d) => ((d.modified ?? '') > m ? d.modified ?? '' : m), '')
  const pages = Math.ceil(list.length / PUBLISHER_PAGE_SIZE)
  for (let p = 1; p <= pages; p++) {
    entries.push({ loc: absoluteUrl(p === 1 ? publisherHref(ns) : `${publisherHref(ns)}p/${p}/`), lastmod: day(latest) })
  }
})
for (const d of datasets) entries.push({ loc: absoluteUrl(`/@${d.namespace}/${d.slug}/`), lastmod: day(d.modified) })

if (entries.length > 50_000) throw new Error(`${entries.length} URLs: split the sitemap (50k per file limit)`)

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  entries.map((e) => `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n') +
  '\n</urlset>\n'
writeFileSync(join(root, 'public', 'sitemap.xml'), xml)
mkdirSync(join(root, '.cache'), { recursive: true })
writeFileSync(join(root, '.cache', 'urls.txt'), entries.map((e) => e.loc).join('\n') + '\n')
console.log(`[sitemap] ${entries.length} URLs (snapshot ${fetchedAt}) → public/sitemap.xml`)
