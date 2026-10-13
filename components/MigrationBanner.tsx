import { PORTALJS_URL, SITE_NAME } from '../lib/site'

// Site-wide notice above the navbar: what this site is, and where it runs now.
export default function MigrationBanner() {
  return (
    <div className="bg-ink px-6 py-2.5 text-center font-sans text-[13px] leading-snug text-cream sm:px-16">
      <strong className="font-semibold">{SITE_NAME}</strong> is the original DataHub catalog of 11,000+ open
      datasets, now migrated to{' '}
      <a href={PORTALJS_URL} className="font-semibold text-cream underline underline-offset-2 hover:opacity-80">
        PortalJS Arc
      </a>
      .
    </div>
  )
}
