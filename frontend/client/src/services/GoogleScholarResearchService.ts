/**
 * Google Scholar Research Service
 * 
 * Fetches academic papers from Google Scholar to improve Virtual Studio features
 * Uses Serpapi for reliable Google Scholar access
 */

export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  citations: number;
  abstract: string;
  pdfUrl?: string;
  scholarUrl: string;
  category: 'pbr' | 'lighting' | 'shadows' | 'gi' | 'ik' | 'animation' | 'volumetrics' | 'skin';
  keywords: string[];
  relevanceScore: number;
  appliedToFeatures: string[];
  improvements: string[];
  source: 'serpapi' | 'mock';
}

export interface ResearchQuery {
  topic: string;
  keywords: string[];
  minCitations?: number;
  yearRange?: { start: number; end: number };
  limit?: number;
}

export interface ResearchStats {
  totalPapers: number;
  categories: Record<string, number>;
  totalCitations: number;
  avgCitationsPerPaper: number;
  topPapers: ResearchPaper[];
}

class GoogleScholarResearchService {
  private apiKey: string | null = null;
  private baseUrl = 'https://serpapi.com/search';
  private cache: Map<string, ResearchPaper[]> = new Map();
  private useMockData = true; // Set to false when API key is available

  constructor() {
    // Try to get API key from environment
    this.apiKey = import.meta.env.VITE_SERPAPI_KEY || null;
    if (!this.apiKey) {
      console.error('❌ SERPAPI_KEY not found. Set VITE_SERPAPI_KEY in .env file. Get key from https://serpapi.com');
      this.useMockData = true;
    } else {
      this.useMockData = false;
      console.log('✅ Google Scholar Research Service initialized with Serpapi');
    }
  }

  /**
   * Search for research papers on a specific topic
   */
  async searchPapers(query: ResearchQuery): Promise<ResearchPaper[]> {
    const cacheKey = JSON.stringify(query);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`📦 Cache hit for query: ${query.topic}`);
      return this.cache.get(cacheKey)!;
    }

    // Require API key
    if (!this.apiKey) {
      throw new Error('SERPAPI_KEY not configured. Set VITE_SERPAPI_KEY in .env file.');
    }

    try {
      // Build search query
      const searchQuery = this.buildSearchQuery(query);

      console.log(`🔍 Searching Google Scholar: "${searchQuery}"`);

      // Call Serpapi
      const url = `${this.baseUrl}?engine=google_scholar&q=${encodeURIComponent(searchQuery)}&api_key=${this.apiKey}&num=${query.limit || 10}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Serpapi request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Check for API errors
      if (data.error) {
        throw new Error(`Serpapi error: ${data.error}`);
      }

      // Parse results
      const papers = this.parseSerpapiResults(data, query);

      console.log(`✅ Found ${papers.length} papers for "${query.topic}"`);

      // Cache results
      this.cache.set(cacheKey, papers);

      return papers;
    } catch (error) {
      console.error('❌ Failed to fetch papers from Serpapi: ', error);
      throw error;
    }
  }

  /**
   * Get research statistics
   */
  async getResearchStats(): Promise<ResearchStats> {
    // Fetch papers for all categories
    const categories = ['pbr','lighting','shadows','gi','ik','animation','volumetrics','skin'];
    const allPapers: ResearchPaper[] = [];
    const categoryCount: Record<string, number> = {};

    for (const category of categories) {
      const papers = await this.searchPapers({
        topic: category,
        keywords: [],
        limit: 5,
      });
      allPapers.push(...papers);
      categoryCount[category] = papers.length;
    }

    // Calculate stats
    const totalCitations = allPapers.reduce((sum, p) => sum + p.citations, 0);
    const topPapers = allPapers
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 10);

    return {
      totalPapers: allPapers.length,
      categories: categoryCount,
      totalCitations,
      avgCitationsPerPaper: Math.round(totalCitations / allPapers.length),
      topPapers,
    };
  }

  /**
   * Find papers related to a specific Virtual Studio feature
   */
  async researchFeature(feature: string): Promise<ResearchPaper[]> {
    const featureQueries: Record<string, ResearchQuery> = {
      'pbr': {
        topic: 'physically based rendering',
        keywords: ['Cook-Torrance','BRDF','GGX','Fresnel','microfacet'],
        minCitations: 100,
        limit: 10,
      },
      'skin-shader': {
        topic: 'subsurface scattering skin rendering',
        keywords: ['SSS','skin shader','translucency','real-time'],
        minCitations: 50,
        limit: 10,
      },
      'soft-shadows': {
        topic: 'percentage closer soft shadows',
        keywords: ['PCSS','shadow maps','contact hardening','penumbra'],
        minCitations: 50,
        limit: 10,
      },
      'global-illumination': {
        topic: 'real-time global illumination',
        keywords: ['GI','indirect lighting','light propagation','voxel cone tracing'],
        minCitations: 100,
        limit: 10,
      },
      'area-lights': {
        topic: 'area light rendering',
        keywords: ['LTC','polygonal lights','soft lighting','real-time'],
        minCitations: 50,
        limit: 10,
      },
      '3d-asset-quality': {
        topic: 'high quality 3D asset creation',
        keywords: ['photogrammetry','procedural generation','mesh optimization','texture baking','LOD generation'],
        minCitations: 50,
        limit: 8,
      },
      'procedural-modeling': {
        topic: 'procedural 3D modeling',
        keywords: ['procedural generation','parametric modeling','L-systems','grammar-based modeling'],
        minCitations: 50,
        limit: 8,
      },
      'mesh-optimization': {
        topic: 'mesh optimization and simplification',
        keywords: ['polygon reduction','mesh decimation','topology optimization','remeshing'],
        minCitations: 50,
        limit: 8,
      },
      'texture-synthesis': {
        topic: 'texture synthesis and generation',
        keywords: ['texture synthesis','material capture','SVBRDF','texture baking','normal mapping'],
        minCitations: 50,
        limit: 8,
      },
      'photogrammetry': {
        topic: 'photogrammetry for 3D reconstruction',
        keywords: ['structure from motion','multi-view stereo','point cloud','mesh reconstruction'],
        minCitations: 100,
        limit: 8,
      },
      'neural-rendering': {
        topic: 'neural rendering and NeRF',
        keywords: ['NeRF','neural radiance fields', 'gaussian splatting','neural rendering'],
        minCitations: 100,
        limit: 8,
      },
    };

    const query = featureQueries[feature];
    if (!query) {
      throw new Error(`Unknown feature: ${feature}`);
    }

    return this.searchPapers(query);
  }

  /**
   * Get quota-aware research recommendations
   * Returns features sorted by priority to minimize API calls
   */
  getQuotaAwareResearchPlan(): { feature: string; priority: number; estimatedCalls: number }[] {
    return [
      // High priority - Core rendering (3 calls)
      { feature: 'pbr', priority: 1, estimatedCalls: 1 },
      { feature: 'global-illumination', priority: 1, estimatedCalls: 1 },
      { feature: 'skin-shader', priority: 1, estimatedCalls: 1 },

      // Medium priority - Lighting & Shadows (2 calls)
      { feature: 'area-lights', priority: 2, estimatedCalls: 1 },
      { feature: 'soft-shadows', priority: 2, estimatedCalls: 1 },

      // High priority - 3D Asset Quality (4 calls)
      { feature: 'neural-rendering', priority: 1, estimatedCalls: 1 },
      { feature: 'photogrammetry', priority: 1, estimatedCalls: 1 },
      { feature: 'procedural-modeling', priority: 2, estimatedCalls: 1 },
      { feature: 'mesh-optimization', priority: 2, estimatedCalls: 1 },

      // Lower priority - Advanced techniques (2 calls)
      { feature: 'texture-synthesis', priority: 3, estimatedCalls: 1 },
      { feature: '3d-asset-quality', priority: 3, estimatedCalls: 1 },
    ];
  }

  /**
   * Research with quota awareness
   * Only researches features if within quota limit
   */
  async researchWithQuotaLimit(features: string[], maxCalls: number): Promise<Map<string, ResearchPaper[]>> {
    const results = new Map<string, ResearchPaper[]>();
    let callsUsed = 0;

    console.log(`🎯 Starting quota-aware research (max ${maxCalls} calls)`);

    for (const feature of features) {
      if (callsUsed >= maxCalls) {
        console.warn(`⚠️ Quota limit reached (${maxCalls} calls). Stopping research.`);
        break;
      }

      // Check cache first (doesn't count against quota)
      const cacheKey = JSON.stringify({ topic: feature });
      if (this.cache.has(cacheKey)) {
        console.log(`📦 Using cached results for ${feature} (no API call)`);
        results.set(feature, this.cache.get(cacheKey)!);
        continue;
      }

      try {
        console.log(`🔍 Researching ${feature} (call ${callsUsed + 1}/${maxCalls})`);
        const papers = await this.researchFeature(feature);
        results.set(feature, papers);
        callsUsed++;

        // Add delay to avoid rate limiting (1 second between calls)
        if (callsUsed < maxCalls) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Failed to research ${feature}:`, error);
      }
    }

    console.log(`✅ Research complete. Used ${callsUsed}/${maxCalls} API calls.`);
    return results;
  }

  /**
   * Build search query string from ResearchQuery
   */
  private buildSearchQuery(query: ResearchQuery): string {
    let searchQuery = query.topic;

    // Add keywords
    if (query.keywords && query.keywords.length > 0) {
      searchQuery += ' ' + query.keywords.join(', ');
    }

    // Add year range
    if (query.yearRange) {
      searchQuery += ` after:${query.yearRange.start} before:${query.yearRange.end}`;
    }

    return searchQuery;
  }

  /**
   * Parse Serpapi results into ResearchPaper objects
   */
  private parseSerpapiResults(data: any, query: ResearchQuery): ResearchPaper[] {
    if (!data.organic_results || data.organic_results.length === 0) {
      console.warn('No results found from Serpapi');
      return [];
    }

    const papers: ResearchPaper[] = [];

    for (const result of data.organic_results) {
      // Extract citation count
      const citationMatch = result.inline_links?.cited_by?.total || 0;
      const citations = typeof citationMatch === 'number' ? citationMatch : 0;

      // Skip if below minimum citations
      if (query.minCitations && citations < query.minCitations) {
        continue;
      }

      // Extract year from publication info
      const yearMatch = result.publication_info?.summary?.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

      // Extract authors
      const authors = result.publication_info?.authors?.map((a: any) => a.name) || [];

      // Determine category from query topic
      const category = this.getCategoryFromTopic(query.topic);

      // Calculate relevance score based on citations and year
      const relevanceScore = this.calculateRelevanceScore(citations, year);

      const paper: ResearchPaper = {
        id: result.result_id || `paper_${Date.now()}_${Math.random()}`,
        title: result.title || 'Untitled',
        authors,
        year,
        citations,
        abstract: result.snippet || ', ',
        pdfUrl: result.resources?.find((r: any) => r.file_format === 'PDF')?.link,
        scholarUrl: result.link || ', ',
        category,
        keywords: query.keywords || [],
        relevanceScore,
        appliedToFeatures: [],
        improvements: [],
        source: 'serpapi',
      };

      papers.push(paper);
    }

    // Sort by relevance score
    papers.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return papers;
  }

  /**
   * Calculate relevance score based on citations and recency
   */
  private calculateRelevanceScore(citations: number, year: number): number {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;

    // Citation score (0-1)
    const citationScore = Math.min(citations / 1000, 1);

    // Recency score (0-1) - newer papers get higher scores
    const recencyScore = Math.max(0, 1 - (age / 20));

    // Weighted average: 70% citations, 30% recency
    return citationScore * 0.7 + recencyScore * 0.3;
  }

  /**
   * Map topic to category
   */
  private getCategoryFromTopic(topic: string): ResearchPaper['category'] {
    const topicLower = topic.toLowerCase();

    if (topicLower.includes('pbr') || topicLower.includes('physically based')) return 'pbr';
    if (topicLower.includes('light') && !topicLower.includes('global')) return 'lighting';
    if (topicLower.includes('shadow')) return 'shadows';
    if (topicLower.includes('global illumination') || topicLower.includes('gi')) return 'gi';
    if (topicLower.includes('ik') || topicLower.includes('inverse kinematics')) return 'ik';
    if (topicLower.includes('animation') || topicLower.includes('pose')) return 'animation';
    if (topicLower.includes('volumetric') || topicLower.includes('fog')) return 'volumetrics';
    if (topicLower.includes('skin') || topicLower.includes('subsurface')) return 'skin';

    return'pbr'; // Default
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Research cache cleared');
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

export const googleScholarResearchService = new GoogleScholarResearchService();
export default googleScholarResearchService;

