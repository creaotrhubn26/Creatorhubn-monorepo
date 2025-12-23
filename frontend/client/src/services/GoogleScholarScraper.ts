/**
 * Google Scholar Web Scraper
 * 
 * Scrapes Google Scholar for research papers WITHOUT using any API
 * Uses CORS proxy to bypass same-origin policy
 * Admin-only feature
 */

export interface ScrapedPaper {
  title: string;
  authors: string[];
  year: number;
  citations: number;
  abstract: string;
  scholarUrl: string;
  pdfUrl?: string;
  relevanceScore: number;
}

export interface ScrapeResult {
  query: string;
  papers: ScrapedPaper[];
  totalResults: number;
  scrapedAt: string;
}

class GoogleScholarScraper {
  private corsProxies = [
    'https://api.allorigins.win/raw?url=','https://corsproxy.io/?','https://api.codetabs.com/v1/proxy?quest=',
  ];

  private currentProxyIndex = 0;
  private requestDelay = 2000; // 2 seconds between requests to avoid rate limiting
  private lastRequestTime = 0;

  /**
   * Scrape Google Scholar for papers
   */
  async scrapePapers(query: string, maxResults: number = 10): Promise<ScrapeResult> {
    console.log(`🔍 Scraping Google Scholar for: "${query}"`);

    // Rate limiting
    await this.respectRateLimit();

    const papers: ScrapedPaper[] = [];
    const scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=en`;

    try {
      // Try each proxy until one works
      let html = '';
      for (let i = 0; i < this.corsProxies.length; i++) {
        try {
          html = await this.fetchWithProxy(scholarUrl, i);
          if (html && html.length > 1000) {
            break;
          }
        } catch (error) {
          console.warn(`Proxy ${i} failed, trying next...`);
        }
      }

      if (!html || html.length < 1000) {
        throw new Error('All proxies failed or returned invalid data');
      }

      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract papers from search results
      const resultElements = doc.querySelectorAll('.gs_ri');
      
      for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
        const element = resultElements[i];
        const paper = this.extractPaperFromElement(element);
        
        if (paper) {
          papers.push(paper);
        }
      }

      console.log(`✅ Scraped ${papers.length} papers from Google Scholar`);

      return {
        query,
        papers,
        totalResults: papers.length,
        scrapedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('Failed to scrape Google Scholar: ', error);
      
      // Fallback: Return empty result instead of throwing
      return {
        query,
        papers: [],
        totalResults: 0,
        scrapedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Fetch URL with CORS proxy
   */
  private async fetchWithProxy(url: string, proxyIndex: number): Promise<string> {
    const proxy = this.corsProxies[proxyIndex];
    const proxiedUrl = proxy + encodeURIComponent(url);

    const response = await fetch(proxiedUrl, {
      headers: {
        'User-Agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Extract paper information from HTML element
   */
  private extractPaperFromElement(element: Element): ScrapedPaper | null {
    try {
      // Title
      const titleElement = element.querySelector('.gs_rt a');
      const title = titleElement?.textContent?.trim() || ', ';
      const scholarUrl = (titleElement as HTMLAnchorElement)?.href || ', ';

      if (!title) {
        return null;
      }

      // Authors and year
      const authorsElement = element.querySelector('.gs_a');
      const authorsText = authorsElement?.textContent || ', ';
      const { authors, year } = this.parseAuthorsAndYear(authorsText);

      // Abstract
      const abstractElement = element.querySelector('.gs_rs');
      const abstract = abstractElement?.textContent?.trim() || ', ';

      // Citations
      const citationsElement = element.querySelector('.gs_fl a');
      const citationsText = citationsElement?.textContent || ', ';
      const citations = this.extractCitations(citationsText);

      // PDF link
      const pdfElement = element.querySelector('.gs_or_ggsm a');
      const pdfUrl = (pdfElement as HTMLAnchorElement)?.href;

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(citations, year);

      return {
        title,
        authors,
        year,
        citations,
        abstract,
        scholarUrl,
        pdfUrl,
        relevanceScore,
      };

    } catch (error) {
      console.error('Failed to extract paper:', error);
      return null;
    }
  }

  /**
   * Parse authors and year from Google Scholar format
   * Example: "J Smith, A Jones - Conference, 2023 - publisher.com"
   */
  private parseAuthorsAndYear(text: string): { authors: string[]; year: number } {
    const authors: string[] = [];
    let year = new Date().getFullYear();

    try {
      // Split by " - " to separate authors from rest
      const parts = text.split(' - ');

      if (parts.length > 0) {
        // Extract authors (before first " - ")
        const authorsText = parts[0].trim();
        const authorsList = authorsText.split('').map(a => a.trim());
        authors.push(...authorsList.slice(0, 5)); // Max 5 authors
      }

      // Extract year (4-digit number)
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }

    } catch (error) {
      console.error('Failed to parse authors/year:', error);
    }

    return { authors, year };
  }

  /**
   * Extract citation count from text
   * Example: "Cited by 123"
   */
  private extractCitations(text: string): number {
    const match = text.match(/Cited by (\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Calculate relevance score based on citations and recency
   */
  private calculateRelevanceScore(citations: number, year: number): number {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;

    // Citation score (0-0.7)
    const citationScore = Math.min(citations / 1000, 0.7);

    // Recency score (0-0.3)
    const recencyScore = Math.max(0, 0.3 - (age * 0.03));

    return Math.min(citationScore + recencyScore, 1.0);
  }

  /**
   * Rate limiting to avoid being blocked
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      console.log(`⏳ Waiting ${waitTime}ms to respect rate limit...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Scrape multiple queries in sequence
   */
  async scrapeMultipleQueries(queries: string[], maxResultsPerQuery: number = 5): Promise<Map<string, ScrapedPaper[]>> {
    const results = new Map<string, ScrapedPaper[]>();

    console.log(`🔍 Scraping ${queries.length} queries from Google Scholar...`);

    for (const query of queries) {
      try {
        const result = await this.scrapePapers(query, maxResultsPerQuery);
        results.set(query, result.papers);

        console.log(`✅ Scraped ${result.papers.length} papers for "${query}"`);
      } catch (error) {
        console.error(`Failed to scrape "${query}":`, error);
        results.set(query, []);
      }
    }

    return results;
  }

  /**
   * Get research papers for component improvements
   */
  async researchComponentImprovements(
    componentName: string,
    researchQueries: string[],
    maxPapersPerQuery: number = 5
  ): Promise<ScrapedPaper[]> {
    console.log(`📚 Researching improvements for ${componentName}...`);

    const allPapers: ScrapedPaper[] = [];

    for (const query of researchQueries) {
      const result = await this.scrapePapers(query, maxPapersPerQuery);
      allPapers.push(...result.papers);
    }

    // Sort by relevance score
    allPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Remove duplicates by title
    const uniquePapers = allPapers.filter((paper, index, self) =>
      index === self.findIndex(p => p.title === paper.title)
    );

    console.log(`✅ Found ${uniquePapers.length} unique papers for ${componentName}`);

    return uniquePapers;
  }

  /**
   * Extract improvement techniques from paper abstracts
   */
  extractImprovementTechniques(papers: ScrapedPaper[]): string[] {
    const techniques: string[] = [];

    for (const paper of papers) {
      const abstract = paper.abstract.toLowerCase();

      // Look for technique keywords
      const keywords = [
        'algorithm','method','technique','approach','framework','optimization','improvement','enhancement','acceleration','real-time','efficient','fast','accurate', 'robust',
      ];

      for (const keyword of keywords) {
        if (abstract.includes(keyword)) {
          // Extract sentence containing keyword
          const sentences = paper.abstract.split(/[.!?]/);
          const relevantSentence = sentences.find(s =>
            s.toLowerCase().includes(keyword)
          );

          if (relevantSentence && relevantSentence.length < 200) {
            techniques.push(relevantSentence.trim());
          }
        }
      }
    }

    // Remove duplicates and limit
    return [...new Set(techniques)].slice(0, 10);
  }
}

export const googleScholarScraper = new GoogleScholarScraper();
export default googleScholarScraper;

