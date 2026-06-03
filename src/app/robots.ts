import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/images/', '/icons/', '/public/'],
      disallow: ['/admin/', '/api/', '/auth/'],
    },
    sitemap: 'https://whateat.sundreamer.app/sitemap.xml',
  }
}
