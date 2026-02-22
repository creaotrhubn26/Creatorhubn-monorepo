// ============================================
// Reference Proxy Routes — shot.cafe + Unsplash
// ============================================
// Proxies external reference image APIs so the frontend
// never needs API keys or CORS workarounds.
// ============================================

import { Router, type Request, type Response } from 'express';

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';
const SHOTCAFE_BASE = 'https://shot.cafe';

export function createReferenceProxyRouter(): Router {
  const router = Router();

  // ── shot.cafe search (films / cinematographers) ──────────
  router.get('/shotcafe/search', async (req: Request, res: Response) => {
    try {
      const { q, z } = req.query as { q?: string; z?: string };
      if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

      const upstream = `${SHOTCAFE_BASE}/api/search?z=${encodeURIComponent(z || 'nav')}&q=${encodeURIComponent(q)}`;
      const response = await fetch(upstream, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `shot.cafe returned ${response.status}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('shot.cafe proxy error:', error);
      res.status(502).json({ error: 'Failed to reach shot.cafe' });
    }
  });

  // ── shot.cafe movie frames ───────────────────────────────
  router.get('/shotcafe/movie/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const upstream = `${SHOTCAFE_BASE}/api/movie/${encodeURIComponent(slug)}`;
      const response = await fetch(upstream, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        // Construct fallback frame URLs
        const frames = Array.from({ length: 12 }, (_, i) => ({
          id: `frame-${slug}-${i + 1}`,
          url: `${SHOTCAFE_BASE}/images/${slug}/${i + 1}.jpg`,
          proxyUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`${SHOTCAFE_BASE}/images/${slug}/${i + 1}.jpg`)}`,
        }));
        return res.json({ slug, frames });
      }

      const data = await response.json();
      // Add proxyUrl to each frame for CORS-safe loading
      if (data.frames) {
        data.frames = data.frames.map((frame: any) => ({
          ...frame,
          proxyUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(frame.url || frame.src || '')}`,
        }));
      }
      res.json(data);
    } catch (error) {
      console.error('shot.cafe movie proxy error:', error);
      res.status(502).json({ error: 'Failed to reach shot.cafe' });
    }
  });

  // ── shot.cafe image proxy (CORS bypass) ──────────────────
  router.get('/shotcafe/image-proxy', async (req: Request, res: Response) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) return res.status(400).json({ error: 'Missing url parameter' });

      // Only allow shot.cafe and picsum URLs
      const allowed = ['shot.cafe', 'picsum.photos'];
      const parsed = new URL(imageUrl);
      if (!allowed.some(h => parsed.hostname.includes(h))) {
        return res.status(403).json({ error: 'URL not allowed' });
      }

      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return res.status(response.status).end();
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Image proxy error:', error);
      res.status(502).end();
    }
  });

  // ── Unsplash search proxy ────────────────────────────────
  router.get('/unsplash/search', async (req: Request, res: Response) => {
    try {
      const { q, per_page = '12', orientation = 'landscape' } = req.query as Record<string, string>;
      if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

      if (!UNSPLASH_ACCESS_KEY) {
        // Return curated picsum placeholders when no API key is configured
        const placeholders = Array.from({ length: 6 }, (_, i) => ({
          id: `picsum-${i}`,
          url: `https://picsum.photos/seed/${encodeURIComponent(q)}${i}/400/225`,
          thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(q)}${i}/150/100`,
          source: 'picsum' as const,
          attribution: 'Placeholder (Unsplash key not configured)',
        }));
        return res.json({ results: placeholders, source: 'picsum' });
      }

      const upstream = new URL('https://api.unsplash.com/search/photos');
      upstream.searchParams.set('query', `${q} cinematic film`);
      upstream.searchParams.set('per_page', per_page);
      upstream.searchParams.set('orientation', orientation);

      const response = await fetch(upstream.toString(), {
        headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        // Fallback to picsum on Unsplash failure
        const placeholders = Array.from({ length: 6 }, (_, i) => ({
          id: `picsum-${i}`,
          url: `https://picsum.photos/seed/${encodeURIComponent(q)}${i}/400/225`,
          thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(q)}${i}/150/100`,
          source: 'picsum' as const,
          attribution: 'Placeholder Image',
        }));
        return res.json({ results: placeholders, source: 'picsum' });
      }

      const data = await response.json();
      const results = (data.results || []).map((img: any) => ({
        id: `unsplash-${img.id}`,
        url: img.urls.regular,
        thumbnailUrl: img.urls.thumb,
        source: 'unsplash' as const,
        attribution: `Photo by ${img.user?.name || 'Unknown'}`,
      }));

      res.json({ results, source: 'unsplash' });
    } catch (error) {
      console.error('Unsplash proxy error:', error);
      res.status(502).json({ error: 'Failed to search images' });
    }
  });

  // ── Pexels search proxy ──────────────────────────────────
  router.get('/pexels/search', async (req: Request, res: Response) => {
    try {
      const { q, per_page = '8' } = req.query as Record<string, string>;
      if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

      if (!PEXELS_API_KEY) {
        const placeholders = Array.from({ length: 6 }, (_, i) => ({
          id: `picsum-pexels-${i}`,
          url: `https://picsum.photos/seed/pexels-${encodeURIComponent(q)}${i}/400/225`,
          thumbnailUrl: `https://picsum.photos/seed/pexels-${encodeURIComponent(q)}${i}/150/100`,
          source: 'picsum' as const,
          attribution: 'Placeholder (Pexels key not configured)',
        }));
        return res.json({ results: placeholders, source: 'picsum' });
      }

      const upstream = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q + ' equipment')}&per_page=${per_page}`;
      const response = await fetch(upstream, {
        headers: { Authorization: PEXELS_API_KEY },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Pexels returned ${response.status}` });
      }

      const data = await response.json();
      const results = (data.photos || []).map((img: any) => ({
        id: `pexels-${img.id}`,
        url: img.src.large,
        thumbnailUrl: img.src.small,
        description: img.alt || q,
        photographer: img.photographer,
        source: 'pexels' as const,
      }));

      res.json({ results, source: 'pexels' });
    } catch (error) {
      console.error('Pexels proxy error:', error);
      res.status(502).json({ error: 'Failed to search Pexels images' });
    }
  });

  // ── Pixabay search proxy ─────────────────────────────────
  router.get('/pixabay/search', async (req: Request, res: Response) => {
    try {
      const { q, per_page = '8' } = req.query as Record<string, string>;
      if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

      if (!PIXABAY_API_KEY) {
        const placeholders = Array.from({ length: 6 }, (_, i) => ({
          id: `picsum-pixabay-${i}`,
          url: `https://picsum.photos/seed/pixabay-${encodeURIComponent(q)}${i}/400/225`,
          thumbnailUrl: `https://picsum.photos/seed/pixabay-${encodeURIComponent(q)}${i}/150/100`,
          source: 'picsum' as const,
          attribution: 'Placeholder (Pixabay key not configured)',
        }));
        return res.json({ results: placeholders, source: 'picsum' });
      }

      const upstream = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&image_type=photo&per_page=${per_page}&safesearch=true`;
      const response = await fetch(upstream, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Pixabay returned ${response.status}` });
      }

      const data = await response.json();
      const results = (data.hits || []).map((img: any) => ({
        id: `pixabay-${img.id}`,
        url: img.largeImageURL,
        thumbnailUrl: img.previewURL,
        description: img.tags,
        photographer: img.user,
        source: 'pixabay' as const,
      }));

      res.json({ results, source: 'pixabay' });
    } catch (error) {
      console.error('Pixabay proxy error:', error);
      res.status(502).json({ error: 'Failed to search Pixabay images' });
    }
  });

  return router;
}
