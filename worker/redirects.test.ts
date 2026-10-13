// Run: npx tsx worker/redirects.test.ts (after npm run fetch:catalog)
import assert from 'node:assert/strict'
import map from './redirect-map.json'
import { legacyRedirect } from './src/index'

const env = { ARC_ORIGIN: 'https://old-datahub.arc.portaljs.com', CKAN_ORIGIN: 'https://api.old.datahub.io' }
const go = (path: string) => {
  const r = legacyRedirect(new URL('https://old.datahub.io' + path), env)
  return r ? `${r.status} ${r.headers.get('Location')}` : 'proxy'
}
const [name, href] = Object.entries(map as Record<string, string>).find(([k]) => !/^[0-9a-f-]{36}$/.test(k))!
const id = Object.entries(map as Record<string, string>).find(([k, v]) => v === href && k !== name)![0]

assert.equal(go(`/dataset/${name}`), `301 https://old.datahub.io${href}`)
assert.equal(go(`/dataset/${id}`), `301 https://old.datahub.io${href}`)
assert.equal(go(`/dataset/${name}/resource/abc-123`), `301 https://old.datahub.io${href}#abc-123`)
assert.equal(go(`/dataset/${name}/resource/r1/download/f.csv`), `302 https://api.old.datahub.io/dataset/${name}/resource/r1/download/f.csv`)
assert.equal(go('/dataset/no-such-dataset-xyz'), '302 https://old.datahub.io/search/?q=no+such+dataset+xyz')
assert.equal(go('/dataset?q=census&tags=health&res_format=CSV'), '301 https://old.datahub.io/search/?q=census&tag=health&format=CSV')
assert.equal(go('/organization/london-datastore-archive'), '301 https://old.datahub.io/search/?org=london-datastore-archive')
assert.equal(go('/api/3/action/package_show?id=x'), '308 https://api.old.datahub.io/api/3/action/package_show?id=x')
assert.equal(go('/user/someone'), '302 https://old.datahub.io/')
assert.equal(go('/'), 'proxy')
assert.equal(go('/search/'), 'proxy')
assert.equal(go(href), 'proxy')
console.log('redirect tests passed;', Object.keys(map).length, 'map keys;', (JSON.stringify(map).length / 1024).toFixed(0), 'KB')
