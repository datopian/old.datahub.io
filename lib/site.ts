// Public site identity, used for canonical URLs, Open Graph tags, JSON-LD and the
// sitemap. Override SITE_URL at build time to build for another host.
export const SITE_URL = (process.env.SITE_URL || 'https://old.datahub.io').replace(/\/+$/, '')
export const SITE_NAME = 'DataHub v1'
export const SITE_DESCRIPTION = 'The original DataHub: 11,000+ open datasets published since 2010.'

export function absoluteUrl(path: string): string {
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`)
}

// URL path of a publisher (CKAN organization) page.
export function publisherHref(namespace: string): string {
  return `/@${namespace}/`
}

// PortalJS Arc — the platform this catalog was migrated to (banner + footer).
export const PORTALJS_URL = 'https://portaljs.com'
