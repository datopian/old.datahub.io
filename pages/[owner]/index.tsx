import type { GetStaticPaths, GetStaticProps } from 'next'
import PublisherListing from '../../components/PublisherListing'
import { getPublisherPage, listPublishers, type PublisherPage } from '../../lib/publishers'

// /@<org>/ — first page of a publisher's datasets.
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await listPublishers()).map((p) => ({ params: { owner: '@' + p.namespace } })),
  fallback: false,
})

export const getStaticProps: GetStaticProps<PublisherPage> = async ({ params }) => {
  const page = await getPublisherPage(String(params?.owner ?? '').replace(/^@/, ''), 1)
  return page ? { props: page } : { notFound: true }
}

export default PublisherListing
