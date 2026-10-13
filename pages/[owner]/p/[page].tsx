import type { GetStaticPaths, GetStaticProps } from 'next'
import PublisherListing from '../../../components/PublisherListing'
import { extraPublisherPages, getPublisherPage, type PublisherPage } from '../../../lib/publishers'

// /@<org>/p/<n>/ — further pages for publishers with more than one page of datasets.
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await extraPublisherPages()).map(({ namespace, page }) => ({
    params: { owner: '@' + namespace, page: String(page) },
  })),
  fallback: false,
})

export const getStaticProps: GetStaticProps<PublisherPage> = async ({ params }) => {
  const page = await getPublisherPage(String(params?.owner ?? '').replace(/^@/, ''), Number(params?.page))
  return page ? { props: page } : { notFound: true }
}

export default PublisherListing
