// Publisher (CKAN organization) listings for the static publisher pages. These are plain
// HTML link lists, so every dataset page is reachable by crawlers without running the
// client-side search.
import { provider } from './providers'

export const PUBLISHER_PAGE_SIZE = 200

export type PublisherSummary = { namespace: string; title: string; count: number }
export type PublisherItem = { slug: string; name: string; summary: string; modified: string | null; formats: string[] }
export type PublisherPage = {
  publisher: PublisherSummary
  items: PublisherItem[]
  page: number
  pages: number
}

type Row = {
  slug: string
  namespace: string
  name: string
  description?: string
  modified?: string
  orgTitle?: string
  resources?: { format?: string }[]
}

function summary(s: string | undefined, max = 180): string {
  if (!s) return ''
  const first = s.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim()
  if (first.length <= max) return first
  const cut = first.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return cut.slice(0, space > 120 ? space : max) + '…'
}

let grouped: Map<string, Row[]> | null = null
async function byPublisher(): Promise<Map<string, Row[]>> {
  if (!grouped) {
    grouped = new Map()
    for (const d of (await provider.listDatasets()) as unknown as Row[]) {
      const list = grouped.get(d.namespace) ?? []
      list.push(d)
      grouped.set(d.namespace, list)
    }
    // Most recently updated first, so a publisher's newest data leads its page.
    grouped.forEach((list) => list.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? '') || a.slug.localeCompare(b.slug)))
  }
  return grouped
}

export async function listPublishers(): Promise<PublisherSummary[]> {
  const out: PublisherSummary[] = []
  ;(await byPublisher()).forEach((list, namespace) =>
    out.push({ namespace, title: list[0]?.orgTitle || namespace, count: list.length })
  )
  return out.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
}

export async function getPublisherPage(namespace: string, page: number): Promise<PublisherPage | null> {
  const list = (await byPublisher()).get(namespace)
  if (!list) return null
  const pages = Math.max(1, Math.ceil(list.length / PUBLISHER_PAGE_SIZE))
  if (page < 1 || page > pages) return null
  const items = list.slice((page - 1) * PUBLISHER_PAGE_SIZE, page * PUBLISHER_PAGE_SIZE).map((d) => ({
    slug: d.slug,
    name: d.name,
    summary: summary(d.description),
    modified: d.modified ? d.modified.slice(0, 10) : null,
    formats: Array.from(new Set((d.resources ?? []).map((r) => String(r.format || '').toUpperCase()).filter(Boolean))).slice(0, 6),
  }))
  return { publisher: { namespace, title: list[0]?.orgTitle || namespace, count: list.length }, items, page, pages }
}

// Every (publisher, page ≥ 2) pair, for the /@<org>/p/<n>/ routes.
export async function extraPublisherPages(): Promise<{ namespace: string; page: number }[]> {
  const out: { namespace: string; page: number }[] = []
  ;(await byPublisher()).forEach((list, namespace) => {
    const pages = Math.ceil(list.length / PUBLISHER_PAGE_SIZE)
    for (let p = 2; p <= pages; p++) out.push({ namespace, page: p })
  })
  return out
}
