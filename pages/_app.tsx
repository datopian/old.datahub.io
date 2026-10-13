import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import Footer from '../components/Footer'
import MigrationBanner from '../components/MigrationBanner'
import Navbar from '../components/Navbar'
import { initAnalytics } from '../lib/analytics'

export default function App({ Component, pageProps }: AppProps) {
  // Analytics load once the browser is idle, so they never compete with the first paint.
  useEffect(() => {
    const start = () => void initAnalytics()
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 3000 })
    else setTimeout(start, 1500)
  }, [])
  // Banner, navbar and footer render on every page (home, search, publishers, datasets).
  return (
    <>
      <MigrationBanner />
      <Navbar />
      <Component {...pageProps} />
      <Footer />
    </>
  )
}
