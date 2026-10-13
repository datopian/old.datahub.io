import Link from 'next/link'
import Seo from './Seo'
import { publisherHref, SITE_NAME } from '../lib/site'
import type { PublisherPage } from '../lib/publishers'

function pageHref(namespace: string, page: number): string {
  return page === 1 ? publisherHref(namespace) : `${publisherHref(namespace)}p/${page}/`
}

// A publisher's datasets as a plain, paginated link list (crawlable without JS).
export default function PublisherListing({ publisher, items, page, pages }: PublisherPage) {
  const path = pageHref(publisher.namespace, page)
  const titleSuffix = page > 1 ? ` (page ${page})` : ''
  return (
    <>
      <Seo
        title={`${publisher.title}${titleSuffix} — datasets on the ${SITE_NAME}`}
        description={`${publisher.count.toLocaleString('en-US')} open dataset${publisher.count === 1 ? '' : 's'} published by ${publisher.title} on the ${SITE_NAME}.`}
        path={path}
      />
      <main className="mx-auto max-w-[940px] px-6 pb-24 sm:px-16">
        <nav className="pt-7 font-sans text-[13px] font-medium text-ink/50">
          <Link href="/" className="text-inherit no-underline hover:text-accent">
            Home
          </Link>{' '}
          /{' '}
          <Link href="/publishers/" className="text-inherit no-underline hover:text-accent">
            Publishers
          </Link>{' '}
          <span className="text-ink">/ {publisher.title}</span>
        </nav>

        <header className="pb-8 pt-8">
          <div className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-accent">Publisher</div>
          <h1 className="mb-3 break-words font-serif text-[40px] font-semibold leading-tight text-ink">{publisher.title}</h1>
          <p className="font-sans text-sm text-ink/55">
            {publisher.count.toLocaleString('en-US')} dataset{publisher.count === 1 ? '' : 's'}
            {pages > 1 ? ` · page ${page} of ${pages}` : ''} ·{' '}
            <Link
              href={`/search/?org=${encodeURIComponent(publisher.namespace)}`}
              className="text-accent underline underline-offset-2"
            >
              search within
            </Link>
          </p>
        </header>

        <ol className="flex flex-col border-t border-ink/[0.15]">
          {items.map((d) => (
            <li key={d.slug} className="border-b border-dotted border-ink/25 py-4">
              <Link href={`/@${publisher.namespace}/${d.slug}/`} className="group block no-underline">
                <h2 className="font-serif text-[19px] font-semibold leading-snug text-ink group-hover:text-accent">{d.name}</h2>
                <div className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/45">
                  {d.formats.join(' · ')}
                  {d.modified ? `${d.formats.length ? ' · ' : ''}updated ${d.modified}` : ''}
                </div>
                {d.summary && <p className="mt-1.5 font-serif text-[15px] leading-relaxed text-ink/70">{d.summary}</p>}
              </Link>
            </li>
          ))}
        </ol>

        {pages > 1 && (
          <nav className="mt-8 flex flex-wrap gap-x-3 gap-y-2 font-sans text-xs" aria-label="Pages">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
              p === page ? (
                <span key={p} className="font-semibold text-ink">
                  {p}
                </span>
              ) : (
                <Link key={p} href={pageHref(publisher.namespace, p)} className="text-accent underline underline-offset-2">
                  {p}
                </Link>
              )
            )}
          </nav>
        )}
      </main>
    </>
  )
}
