import type { MetadataRoute } from 'next';
const baseUrl = 'https://nextgen-miner.vercel.app';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/wallet', '/admin', '/api/'] }, sitemap: `${baseUrl}/sitemap.xml`, host: baseUrl };
}
