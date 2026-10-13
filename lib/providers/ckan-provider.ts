// CKAN-backed provider, wired by /portaljs-connect-ckan.
//
// The catalog is a build-time snapshot: scripts/fetch-catalog.ts pages the whole CKAN
// catalog (package_search, 1000 per request) into .cache/catalog.json before
// `next build`, and this provider serves the surfaces from that file. That keeps the
// export fully static (no CKAN calls from the browser) and avoids one package_show per
// dataset page on large catalogs. Rebuild to pick up CKAN changes.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DataProvider, Dataset, DatasetQuery, ProviderCapabilities, Resource } from './types'

// CKAN formats are open-ended (pdf, zip, rdf, xls…); the template's DataFormat names the
// ones the showcase can preview. Unknown formats render as a plain download.
export type CkanResource = Omit<Resource, 'format'> & { format: string; size?: number }

export type CkanDataset = Omit<Dataset, 'resources'> & {
  id: string
  orgTitle: string
  resources: CkanResource[]
  author?: string
  ckanUrl: string
  // Tags shared by enough datasets to be a search filter (scripts/fetch-catalog.ts).
  facetTags?: string[]
  // CKAN notes rendered from Markdown and sanitized at fetch time; `description` holds
  // the plain-text version.
  descriptionHtml?: string
}

type Snapshot = { source: string; fetchedAt: string; count: number; datasets: CkanDataset[] }

export const CATALOG_FILE = join(process.cwd(), '.cache', 'catalog.json')

export function hasCatalogSnapshot(): boolean {
  return existsSync(CATALOG_FILE)
}

let cached: Snapshot | null = null
export function loadSnapshot(): Snapshot {
  if (!cached) {
    if (!hasCatalogSnapshot()) {
      throw new Error(`${CATALOG_FILE} is missing — run \`npm run fetch:catalog\` first`)
    }
    cached = JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) as Snapshot
  }
  return cached
}

let index: Map<string, CkanDataset> | null = null
function byKey(): Map<string, CkanDataset> {
  if (!index) index = new Map(loadSnapshot().datasets.map((d) => [`${d.namespace}/${d.slug}`, d]))
  return index
}

export class CkanProvider implements DataProvider {
  readonly name = 'ckan'
  // Search runs in the browser over a static Pagefind index (see pages/search.tsx), not
  // against CKAN, so the provider itself reports the static baseline.
  readonly capabilities: ProviderCapabilities = { search: false, query: false, write: false, rbac: false }

  async listDatasets(): Promise<Dataset[]> {
    return loadSnapshot().datasets as unknown as Dataset[]
  }

  async getDataset(namespace: string, slug: string): Promise<Dataset | null> {
    return (byKey().get(`${namespace}/${slug}`) as unknown as Dataset) ?? null
  }

  async search({ q, namespace, format }: DatasetQuery): Promise<Dataset[]> {
    const needle = (q || '').trim().toLowerCase()
    return loadSnapshot().datasets.filter(
      (d) =>
        (!namespace || d.namespace === namespace) &&
        (!format || d.resources.some((r) => r.format === format)) &&
        (!needle ||
          d.name.toLowerCase().includes(needle) ||
          (d.description || '').toLowerCase().includes(needle))
    ) as unknown as Dataset[]
  }
}
