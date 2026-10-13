import Link from 'next/link'
import { PORTALJS_URL, SITE_NAME } from '../lib/site'

// Site-wide footer: the PortalJS Arc note, plus plain links crawlers can follow.
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-ink/[0.12] bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 font-sans text-[13px] text-ink/60 sm:flex-row sm:items-start sm:justify-between sm:px-16">
        <p className="max-w-[560px] leading-relaxed">
          {SITE_NAME} runs on{' '}
          <a href={PORTALJS_URL} className="font-medium text-accent underline underline-offset-2">
            PortalJS Arc
          </a>
          : a static, serverless data portal by Datopian, built from the original DataHub CKAN catalog. Dataset
          metadata stays available through the{' '}
          <a href="https://api.old.datahub.io/api/3" className="text-accent underline underline-offset-2">
            CKAN API
          </a>
          .
        </p>
        <nav className="flex gap-6 font-semibold uppercase tracking-[0.06em] text-[11px]" aria-label="Footer">
          <Link href="/search/" className="text-ink/60 no-underline hover:text-accent">
            Search
          </Link>
          <Link href="/publishers/" className="text-ink/60 no-underline hover:text-accent">
            Publishers
          </Link>
          <a href={PORTALJS_URL} className="text-ink/60 no-underline hover:text-accent">
            PortalJS
          </a>
        </nav>
      </div>
    </footer>
  )
}
