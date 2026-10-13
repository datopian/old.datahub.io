import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Footer from '../components/Footer'
import MigrationBanner from '../components/MigrationBanner'
import Navbar from '../components/Navbar'

export default function App({ Component, pageProps }: AppProps) {
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
