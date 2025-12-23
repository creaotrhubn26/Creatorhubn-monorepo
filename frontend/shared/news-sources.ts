/**
 * News Sources Database for Equipment Categories
 * Comprehensive list of industry news sources for photography, videography, and audio equipment
 */

export interface NewsSource {
  id: string;
  name: string;
  baseUrl: string;
  rssUrl?: string;
  categories: NewsCategory[];
  region: 'global' | 'us' | 'eu' | 'asia';
  language: 'en' | 'no' | 'multi';
  updateFrequency: 'daily' | 'weekly' | 'hourly';
  reliability: 'high' | 'medium' | 'low';
  description: string;
}

export type NewsCategory =
  | 'cameras'
  | 'video-equipment'
  | 'video-lights'
  | 'photo-flashes'
  | 'audio-equipment'
  | 'general'
  | 'industry'
  | 'reviews'
  | 'tutorials';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishDate: string;
  imageUrl?: string;
  author?: string;
  tags: string[];
}

/**
 * Comprehensive News Sources Database
 */
export const NEWS_SOURCES_DATABASE: NewsSource[] = [
  // Video/Film Industry News
  {
    id: 'no-film-school',
    name: 'No Film School',
    baseUrl: 'https://nofilmschool.com',
    rssUrl: 'https://nofilmschool.com/feed',
    categories: ['video-equipment', 'cameras', 'industry', 'tutorials'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Leading resource for filmmakers and video professionals',
  },
  {
    id: 'cined',
    name: 'CineD',
    baseUrl: 'https://www.cined.com',
    rssUrl: 'https://www.cined.com/feed/',
    categories: ['video-equipment', 'cameras', 'reviews', 'industry'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Cinema technology and equipment news',
  },
  {
    id: 'newsshooter',
    name: 'Newsshooter',
    baseUrl: 'https://www.newsshooter.com',
    rssUrl: 'https://www.newsshooter.com/feed/',
    categories: ['video-equipment', 'cameras', 'video-lights', 'audio-equipment'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Professional video equipment news and reviews',
  },
  {
    id: 'ym-cinema',
    name: 'Y.M.Cinema Magazine',
    baseUrl: 'https://ymcinema.com',
    rssUrl: 'https://ymcinema.com/feed/',
    categories: ['video-equipment', 'cameras', 'industry'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Cinema and video production technology',
  },
  {
    id: 'redshark-news',
    name: 'RedShark News',
    baseUrl: 'https://www.redsharknews.com',
    rssUrl: 'https://www.redsharknews.com/feed',
    categories: ['video-equipment', 'cameras', 'audio-equipment', 'industry'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Professional video and audio technology news',
  },

  // Photography Industry News
  {
    id: 'dpreview',
    name: 'DPReview',
    baseUrl: 'https://www.dpreview.com',
    rssUrl: 'https://www.dpreview.com/feeds/news.xml',
    categories: ['cameras', 'photo-flashes', 'video-lights', 'reviews'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Comprehensive camera and photography equipment reviews',
  },
  {
    id: 'petapixel',
    name: 'PetaPixel',
    baseUrl: 'https://petapixel.com',
    rssUrl: 'https://petapixel.com/feed/',
    categories: ['cameras', 'photo-flashes', 'industry', 'tutorials'],
    region: 'global',
    language: 'en',
    updateFrequency: 'hourly',
    reliability: 'high',
    description: 'Photography news, reviews, and tutorials',
  },
  {
    id: 'fstoppers',
    name: 'Fstoppers',
    baseUrl: 'https://fstoppers.com',
    rssUrl: 'https://fstoppers.com/feed',
    categories: ['cameras', 'photo-flashes', 'video-lights', 'tutorials'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Professional photography community and news',
  },
  {
    id: 'diy-photography',
    name: 'DIYPhotography',
    baseUrl: 'https://www.diyphotography.net',
    rssUrl: 'https://www.diyphotography.net/feed/',
    categories: ['cameras', 'photo-flashes', 'video-lights', 'tutorials'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'medium',
    description: 'DIY photography tips and equipment hacks',
  },
  {
    id: 'imaging-resource',
    name: 'Imaging Resource',
    baseUrl: 'https://www.imaging-resource.com',
    rssUrl: 'https://www.imaging-resource.com/news/rss.xml',
    categories: ['cameras', 'reviews', 'industry'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Digital camera reviews and imaging technology',
  },

  // Audio Industry News
  {
    id: 'sound-on-sound',
    name: 'Sound on Sound',
    baseUrl: 'https://www.soundonsound.com',
    rssUrl: 'https://www.soundonsound.com/feed',
    categories: ['audio-equipment', 'reviews', 'tutorials'],
    region: 'global',
    language: 'en',
    updateFrequency: 'weekly',
    reliability: 'high',
    description: 'Professional audio recording and production',
  },
  {
    id: 'transom',
    name: 'Transom',
    baseUrl: 'https://transom.org',
    rssUrl: 'https://transom.org/feed/',
    categories: ['audio-equipment', 'tutorials', 'industry'],
    region: 'global',
    language: 'en',
    updateFrequency: 'weekly',
    reliability: 'high',
    description: 'Audio storytelling and recording techniques',
  },

  // Broadcast Industry News
  {
    id: 'broadcast-bridge',
    name: 'The Broadcast Bridge',
    baseUrl: 'https://www.thebroadcastbridge.com',
    rssUrl: 'https://www.thebroadcastbridge.com/feed',
    categories: ['video-equipment', 'audio-equipment', 'cameras', 'industry'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Professional broadcast technology and workflows',
  },
  {
    id: 'production-hub',
    name: 'ProductionHUB',
    baseUrl: 'https://www.productionhub.com',
    rssUrl: 'https://www.productionhub.com/feed',
    categories: ['video-equipment', 'audio-equipment', 'industry'],
    region: 'global',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'medium',
    description: 'Video production industry news and resources',
  },

  // Retailer Learning Centers
  {
    id: 'bh-explora',
    name: 'B&H Explora',
    baseUrl: 'https://www.bhphotovideo.com/explora',
    rssUrl: 'https://www.bhphotovideo.com/explora/feed',
    categories: ['cameras', 'video-equipment', 'photo-flashes', 'audio-equipment', 'tutorials'],
    region: 'us',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Professional photography and video equipment education',
  },
  {
    id: 'adorama-learning',
    name: 'Adorama Learning Center',
    baseUrl: 'https://www.adorama.com/alc',
    rssUrl: 'https://www.adorama.com/alc/feed/',
    categories: ['cameras', 'video-equipment', 'photo-flashes', 'tutorials'],
    region: 'us',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Photography and videography tutorials and reviews',
  },
  {
    id: 'cvp-news',
    name: 'CVP News',
    baseUrl: 'https://www.cvp.com/blog',
    rssUrl: 'https://www.cvp.com/blog/feed/',
    categories: ['video-equipment', 'cameras', 'audio-equipment', 'reviews'],
    region: 'eu',
    language: 'en',
    updateFrequency: 'daily',
    reliability: 'high',
    description: 'Professional video equipment news and reviews',
  },
  {
    id: 'moment',
    name: 'Moment',
    baseUrl: 'https://www.shopmoment.com/blog',
    rssUrl: 'https://www.shopmoment.com/blog.rss',
    categories: ['cameras', 'video-equipment', 'tutorials'],
    region: 'global',
    language: 'en',
    updateFrequency: 'weekly',
    reliability: 'medium',
    description: 'Mobile photography and filmmaking',
  },
];

/**
 * Get news sources by category
 */
export function getNewsByCategory(category: NewsCategory): NewsSource[] {
  return NEWS_SOURCES_DATABASE.filter((source) => source.categories.includes(category));
}

/**
 * Get all available categories
 */
export function getAllNewsCategories(): NewsCategory[] {
  const categories = new Set<NewsCategory>();
  NEWS_SOURCES_DATABASE.forEach((source) => {
    source.categories.forEach((cat) => categories.add(cat));
  });
  return Array.from(categories).sort();
}

/**
 * Get high reliability sources
 */
export function getHighReliabilitySources(): NewsSource[] {
  return NEWS_SOURCES_DATABASE.filter((source) => source.reliability === 'high');
}
