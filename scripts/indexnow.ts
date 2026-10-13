// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver…) about every URL in the
// sitemap. Run after a deploy: `npm run indexnow`. Google doesn't use IndexNow; submit
// the sitemap in Search Console for Google.
//
// The key file public/<key>.txt proves we own the host; it must be live before this runs.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SITE_URL } from '../lib/site'

const root = join(__dirname, '..')
const keyFile = readdirSync(join(root, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) throw new Error('no IndexNow key file (public/<32 hex>.txt)')
const key = keyFile.replace(/\.txt$/, '')
const urls = readFileSync(join(root, '.cache', 'urls.txt'), 'utf8').split('\n').filter(Boolean)
const host = new URL(SITE_URL).host

async function main() {
  const live = await fetch(`${SITE_URL}/${keyFile}`)
  if (!live.ok || (await live.text()).trim() !== key) throw new Error(`${SITE_URL}/${keyFile} is not live yet — deploy first`)
  // IndexNow accepts up to 10,000 URLs per request.
  for (let i = 0; i < urls.length; i += 10_000) {
    const batch = urls.slice(i, i + 10_000)
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${keyFile}`, urlList: batch }),
    })
    console.log(`[indexnow] ${batch.length} URLs → HTTP ${res.status} ${res.status === 200 || res.status === 202 ? 'accepted' : await res.text()}`)
  }
}

main().catch((e) => {
  console.error('[indexnow]', e.message)
  process.exit(1)
})
