// old.datahub.io edge Worker.
//
// 1. Old CKAN URLs (the site was a CKAN portal for years and is linked from all over the
//    web) are permanently redirected to the static portal's /@<org>/<dataset>/ pages, using
//    the name/id → path map generated at build time (scripts/fetch-catalog.ts).
// 2. The CKAN API and file downloads go to the CKAN backend (api.old.datahub.io), which
//    still serves them (downloads redirect on to R2).
// 3. Everything else is the static export (out/), served from this Worker's static
//    assets. (PortalJS Arc's upload API can't take a 34k-file export yet.)
import redirectMap from '../redirect-map.json'

export interface Env {
  CKAN_ORIGIN: string // e.g. https://api.old.datahub.io
  ASSETS: { fetch: (req: Request) => Promise<Response> } // the static export (wrangler.toml [assets])
}

const MAP = redirectMap as Record<string, string>

function redirect(location: string, status = 301): Response {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': 'public, max-age=86400' } })
}

function searchUrl(origin: string, params: Record<string, string | undefined>): string {
  const u = new URL('/search/', origin)
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
  return u.toString()
}

// Map an old CKAN request to its new location, or null to serve it from the portal.
export function legacyRedirect(url: URL, env: Env): Response | null {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const seg = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  const origin = url.origin

  // CKAN API, uploaded group/org images: still served by CKAN. 308 keeps POST as POST.
  if (seg[0] === 'api' || seg[0] === 'uploads') return redirect(env.CKAN_ORIGIN + url.pathname + url.search, 308)

  if (seg[0] === 'dataset' || seg[0] === 'datasets') {
    // /dataset?q=…&tags=…&res_format=…&organization=… → the search page.
    if (seg.length === 1) {
      const p = url.searchParams
      return redirect(
        searchUrl(origin, {
          q: p.get('q') || undefined,
          tag: p.getAll('tags').join(',') || undefined,
          format: p.getAll('res_format').join(',') || undefined,
          org: p.get('organization') || undefined,
        })
      )
    }
    const key = seg[1]
    // File downloads: CKAN resolves them (and redirects to R2).
    if (seg[2] === 'resource' && seg[4] === 'download') {
      return redirect(env.CKAN_ORIGIN + url.pathname + url.search, 302)
    }
    const target = MAP[key]
    if (!target) return redirect(searchUrl(origin, { q: key.replace(/[-_]+/g, ' ') }), 302)
    // /dataset/<x>/resource/<rid> → the resource row on the dataset page.
    if (seg[2] === 'resource' && seg[3]) return redirect(origin + target + '#' + seg[3])
    return redirect(origin + target)
  }

  if (seg[0] === 'organization') return redirect(seg[1] ? searchUrl(origin, { org: seg[1] }) : searchUrl(origin, {}))
  if (seg[0] === 'group') return redirect(searchUrl(origin, { q: seg[1]?.replace(/[-_]+/g, ' ') }))
  if (seg[0] === 'tag' && seg[1]) return redirect(searchUrl(origin, { tag: seg[1] }))
  // Other CKAN-only pages (users, activity, revisions, about, dashboard) have no
  // equivalent in the static portal.
  if (['user', 'activity', 'revision', 'dashboard', 'about', 'ckan-admin', 'harvest'].includes(seg[0] || '')) {
    return redirect(origin + '/', 302)
  }
  return null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const legacy = legacyRedirect(url, env)
    if (legacy) return legacy

    // The assets layer stores dataset pages under %40-encoded paths and 307s a literal
    // `/@org/…` to `/%40org/…`. Look them up encoded so visitors keep the clean
    // /@<org>/<dataset>/ URL and get a 200 with no redirect.
    if (url.pathname.includes('@')) {
      const encoded = new URL(url)
      encoded.pathname = url.pathname.replace(/@/g, '%40')
      return env.ASSETS.fetch(new Request(encoded.toString(), request))
    }
    return env.ASSETS.fetch(request)
  },
}
