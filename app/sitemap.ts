import type { MetadataRoute } from 'next';
const baseUrl = 'https://nextgen-miner.vercel.app';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/legal/privacy`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${baseUrl}/legal/terms`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
