import Head from 'next/head'
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '../lib/site'

// Per-page search-engine and social tags. Every tag carries a `key`, so a page's Seo
// replaces the site defaults (pages/_app.tsx) instead of adding a duplicate.
export default function Seo({
  title,
  description = SITE_DESCRIPTION,
  path,
  noindex = false,
  type = 'website',
  jsonLd,
}: {
  title: string
  description?: string
  // Site-relative path, used for the canonical URL and og:url.
  path: string
  // "noindex, follow" — crawlers follow the links but leave the page out of the index.
  noindex?: boolean
  type?: 'website' | 'article'
  jsonLd?: object
}) {
  const url = absoluteUrl(path)
  return (
    <Head>
      <title key="title">{title}</title>
      <meta key="description" name="description" content={description} />
      <link key="canonical" rel="canonical" href={url} />
      {noindex && <meta key="robots" name="robots" content="noindex, follow" />}
      <meta key="og:site_name" property="og:site_name" content={SITE_NAME} />
      <meta key="og:type" property="og:type" content={type} />
      <meta key="og:title" property="og:title" content={title} />
      <meta key="og:description" property="og:description" content={description} />
      <meta key="og:url" property="og:url" content={url} />
      <meta key="twitter:card" name="twitter:card" content="summary" />
      {jsonLd && (
        <script
          key="jsonld"
          type="application/ld+json"
          // `<` is escaped so dataset text can never close the script tag early.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
    </Head>
  )
}
