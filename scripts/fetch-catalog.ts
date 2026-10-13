// Build-time CKAN snapshot. Pages the whole catalog out of CKAN once (package_search,
// 1000 per request) and writes:
//   .cache/catalog.json        — the datasets in the portal's Dataset shape, read by
//                                lib/providers/ckan-provider.ts during `next build`
//   worker/redirect-map.json   — CKAN name/id → /@<org>/<name>, used by the
//                                old.datahub.io Worker to 301 old CKAN URLs
// Run via `npm run fetch:catalog` (prebuild). Set DMS to point at another CKAN and
// MAX_DATASETS to cap a quick dev build.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { ckan, DMS, GROUP_FILTER, ORG_FILTER, type CkanPackage } from '../lib/ckan'
import type { CkanDataset } from '../lib/providers/ckan-provider'

// Namespace for the few datasets with no organization.
export const FALLBACK_NAMESPACE = 'datahub'

// CKAN formats the template's showcase knows how to preview/label; everything else is
// carried through as a lowercase label and offered as a plain download.
const KNOWN = new Set(['csv', 'tsv', 'json', 'geojson', 'parquet'])

const MIN_TAG_DATASETS = 5
const MAX_NOTES = 20_000
const MAX_RES_DESC = 1_000

function clip(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined
  const t = s.trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

// CKAN notes are Markdown, often with raw HTML mixed in. Render once here: sanitized
// HTML for the showcase's About section, plain text for leads, meta and search.
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'a', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    h1: 'h3',
    h2: 'h3',
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener' }),
  },
}

function renderNotes(notes: string | undefined): { html?: string; text?: string } {
  const src = clip(notes, MAX_NOTES)
  if (!src) return {}
  const html = sanitizeHtml(marked.parse(src, { async: false, gfm: true, breaks: true }) as string, SANITIZE).trim()
  const text = sanitizeHtml(html.replace(/<\/(p|li|h3|h4|tr|blockquote)>|<br\s*\/?>/g, '$&\n'), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { html: html || undefined, text: text || undefined }
}

function toDataset(p: CkanPackage): CkanDataset {
  const namespace = p.organization?.name || FALLBACK_NAMESPACE
  const resources = (p.resources || [])
    .filter((r) => r.url)
    .map((r) => {
      const raw = (r.format || '').trim().toLowerCase().replace(/^\./, '')
      const format = KNOWN.has(raw) ? raw : raw || 'file'
      return {
        name: r.id,
        path: r.url as string,
        format,
        title: (r.name || '').trim() || undefined,
        description: clip(r.description, MAX_RES_DESC),
        size: r.size ?? undefined,
      }
    })
  const notes = renderNotes(p.notes)
  const ds: CkanDataset = {
    id: p.id,
    slug: p.name,
    namespace,
    orgTitle: p.organization?.title || (p.organization ? namespace : 'DataHub'),
    name: (p.title || p.name).trim(),
    description: notes.text,
    descriptionHtml: notes.html,
    resources,
    keywords: (p.tags || []).map((t) => t.display_name || t.name).filter(Boolean),
    licenses: p.license_title || p.license_id
      ? [{ name: p.license_id || undefined, title: p.license_title || p.license_id, path: p.license_url || undefined }]
      : undefined,
    sources: p.url ? [{ title: p.url, path: p.url }] : undefined,
    created: p.metadata_created || undefined,
    modified: p.metadata_modified || undefined,
    version: p.version || undefined,
    author: p.author || p.maintainer || undefined,
    ckanUrl: `${DMS}/dataset/${p.name}`,
  }
  // getStaticProps can't serialize `undefined` — drop absent keys.
  return JSON.parse(JSON.stringify(ds))
}

async function main() {
  const started = Date.now()
  const { datasets, count } = await ckan.allDatasets({ orgs: ORG_FILTER, groups: GROUP_FILTER })
  const out = datasets.map(toDataset)

  // Only tags shared by enough datasets become search filters — a long tail of one-off
  // tags would bloat the Pagefind filter index. Every tag stays searchable as text.
  const tagCount = new Map<string, number>()
  for (const d of out) {
    for (const t of Array.from(new Set(d.keywords ?? []))) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  }
  for (const d of out) {
    const facet = (d.keywords ?? []).filter((t) => (tagCount.get(t) ?? 0) >= MIN_TAG_DATASETS)
    if (facet.length) d.facetTags = facet
  }

  const root = join(__dirname, '..')
  const write = (rel: string, data: unknown) => {
    const file = join(root, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data))
  }
  write('.cache/catalog.json', { source: DMS, fetchedAt: new Date().toISOString(), count, datasets: out })

  // Redirect map for the old CKAN URL scheme: both the package name and its UUID resolve.
  const byKey: Record<string, string> = {}
  for (const d of out) {
    // Trailing slash matches the export (next.config trailingSlash) — no extra hop.
    const href = `/@${d.namespace}/${d.slug}/`
    byKey[d.slug] = href
    byKey[d.id] = href
  }
  write('worker/redirect-map.json', byKey)

  const resources = out.reduce((n, d) => n + (d.resources?.length || 0), 0)
  console.log(
    `[fetch-catalog] ${out.length} datasets (catalog has ${count}), ${resources} resources from ${DMS} ` +
      `in ${((Date.now() - started) / 1000).toFixed(1)}s`
  )
  if (!out.length) throw new Error('CKAN returned no datasets — check DMS and the filters in lib/ckan.ts')
}

main().catch((e) => {
  console.error('[fetch-catalog]', e)
  process.exit(1)
})
