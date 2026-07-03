import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Hellnah Terminal'
const BASE_URL  = 'https://hellnah-terminal.id'
const DEFAULT_DESC = 'Platform trading kripto institusional dengan sinyal multi-timeframe (MTF), bullish scanner real-time, dan analisis teknikal berbasis algoritma.'
const DEFAULT_IMG  = 'https://hellnah-terminal.id/og-image.png'

interface Props {
  title: string
  description?: string
  keywords?: string
  canonical?: string   // relative path, e.g. '/articles/my-slug'
  ogImage?: string
  ogType?: 'website' | 'article'
  publishedAt?: string
  author?: string
  noindex?: boolean
  jsonLd?: Record<string, unknown>
}

export function SEOHead({
  title,
  description = DEFAULT_DESC,
  keywords,
  canonical,
  ogImage = DEFAULT_IMG,
  ogType = 'website',
  publishedAt,
  author,
  noindex = false,
  jsonLd,
}: Props) {
  const fullTitle   = `${title} — ${SITE_NAME}`
  const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : undefined

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex
        ? <meta name="robots" content="noindex, nofollow" />
        : <meta name="robots" content="index, follow" />
      }
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:type"        content={ogType} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={ogImage} />
      {canonicalUrl   && <meta property="og:url"                      content={canonicalUrl} />}
      {publishedAt    && <meta property="article:published_time"      content={publishedAt} />}
      {author         && <meta property="article:author"              content={author} />}

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={ogImage} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  )
}
