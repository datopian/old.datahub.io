import Link from 'next/link'
import Seo from '../components/Seo'
import { listPublishers, type PublisherSummary } from '../lib/publishers'
import { publisherHref, SITE_NAME } from '../lib/site'

export async function getStaticProps() {
  return { props: { publishers: await listPublishers() } }
}

// /publishers/ — every publisher with its dataset count, linked to its listing.
export default function Publishers({ publishers }: { publishers: PublisherSummary[] }) {
  const total = publishers.reduce((n, p) => n + p.count, 0)
  return (
    <>
      <Seo
        title={`Publishers — ${SITE_NAME}`}
        description={`${publishers.length} publishers of ${total.toLocaleString('en-US')} open datasets on the ${SITE_NAME}.`}
        path="/publishers/"
      />
      <main className="mx-auto max-w-[940px] px-6 pb-24 sm:px-16">
        <nav className="pt-7 font-sans text-[13px] font-medium text-ink/50">
          <Link href="/" className="text-inherit no-underline hover:text-accent">
            Home
          </Link>{' '}
          <span className="text-ink">/ Publishers</span>
        </nav>
        <header className="pb-8 pt-8">
          <h1 className="mb-3 font-serif text-[40px] font-semibold leading-tight text-ink">Publishers</h1>
          <p className="font-sans text-sm text-ink/55">
            {publishers.length} publishers · {total.toLocaleString('en-US')} datasets
          </p>
        </header>
        <ul className="grid grid-cols-1 gap-x-10 border-t border-ink/[0.15] sm:grid-cols-2">
          {publishers.map((p) => (
            <li key={p.namespace} className="border-b border-dotted border-ink/25 py-2.5">
              <Link
                href={publisherHref(p.namespace)}
                className="flex items-baseline justify-between gap-3 font-serif text-[16px] text-ink no-underline hover:text-accent"
              >
                <span className="min-w-0 truncate">{p.title}</span>
                <span className="flex-shrink-0 font-sans text-[11px] text-ink/40">{p.count.toLocaleString('en-US')}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
