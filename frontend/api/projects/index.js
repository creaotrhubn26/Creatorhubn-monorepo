import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // Try legacy.projects first (has user_id, richer data), fallback to public.projects
      let rows;
      try {
        const result = await pool.query(`
          SELECT id, name, title, description, profession, status,
                 client_email, client_phone, location, date, event_date,
                 featured, published, settings, metadata,
                 created_at, updated_at, user_id
          FROM legacy.projects
          ORDER BY created_at DESC
        `);
        rows = result.rows.map(r => ({
          id: r.id,
          name: r.name || r.title,
          title: r.title || r.name,
          description: r.description,
          profession: r.profession,
          status: r.status || 'active',
          clientEmail: r.client_email,
          clientPhone: r.client_phone,
          location: r.location,
          date: r.date || r.event_date,
          eventDate: r.event_date || r.date,
          featured: r.featured,
          published: r.published,
          settings: r.settings,
          metadata: r.metadata,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          userId: r.user_id,
        }));
      } catch {
        // Fallback to public.projects
        const result = await pool.query(`
          SELECT id, title, slug, description, category, cover_image,
                 video_url, date, location, featured, published,
                 sort_order, created_at, updated_at
          FROM public.projects
          ORDER BY created_at DESC
        `);
        rows = result.rows.map(r => ({
          id: r.id,
          name: r.title,
          title: r.title,
          slug: r.slug,
          description: r.description,
          category: r.category,
          coverImage: r.cover_image,
          videoUrl: r.video_url,
          date: r.date,
          location: r.location,
          featured: r.featured,
          published: r.published,
          sortOrder: r.sort_order,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }

      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { title, name, description, location, date, category, userId } = req.body || {};
      const projectName = title || name || 'Nytt prosjekt';
      const id = crypto.randomUUID();

      await pool.query(`
        INSERT INTO legacy.projects (id, name, title, description, location, date, status, user_id, created_at, updated_at)
        VALUES ($1, $2, $2, $3, $4, $5, 'active', $6, NOW(), NOW())
      `, [id, projectName, description || '', location || '', date || null, userId || null]);

      return res.status(201).json({
        id,
        name: projectName,
        title: projectName,
        description: description || '',
        location: location || '',
        date: date || null,
        status: 'active',
        userId: userId || null,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Projects API error:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}
