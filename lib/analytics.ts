// Visitor analytics: PostHog project "DataHub v1" (EU cloud), cookieless.
//
// - cookieless_mode 'always': nothing is stored in the browser, so no consent banner is
//   needed. PostHog counts unique visitors with a daily-rotating server-side hash (project
//   setting cookieless_server_hash_mode = stateful). IPs are anonymized in the project.
// - Only pageviews plus two custom events: dataset_search and resource_download.
//   No autocapture, session replay, surveys or feature flags.
// - Loaded lazily after the page is interactive, and only on the production host, so local
//   and preview builds send nothing.
import type { PostHog } from 'posthog-js'
import { SITE_URL } from './site'

// Project API key: a public, write-only ingestion token (safe in client code).
const POSTHOG_KEY = 'phc_zybVJ5BVVqftDUMRqa2FL8GabKwUH2FMVqSTefhr7zaR'
const POSTHOG_HOST = 'https://eu.i.posthog.com'

let client: Promise<PostHog | null> | null = null

function enabled(): boolean {
  return typeof window !== 'undefined' && window.location.host === new URL(SITE_URL).host
}

export function initAnalytics(): Promise<PostHog | null> {
  if (client) return client
  if (!enabled()) return (client = Promise.resolve(null))
  client = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        defaults: '2025-05-24',
        cookieless_mode: 'always',
        // Next.js navigates client-side; count those page changes too.
        capture_pageview: 'history_change',
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
      })
      return posthog
    })
    .catch(() => null)
  return client
}

export function track(event: 'dataset_search' | 'resource_download', props: Record<string, unknown>): void {
  void initAnalytics().then((ph) => ph?.capture(event, props, event === 'resource_download' ? { transport: 'sendBeacon' } : undefined))
}
