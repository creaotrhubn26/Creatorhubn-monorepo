import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

  try {
    // Try legacy first
    let row;
    try {
      const result = await pool.query(`
        SELECT id, name, title, description, profession, status,
               client_email, client_phone, location, date, event_date,
               featured, published, settings, metadata,
               created_at, updated_at, user_id
        FROM legacy.projects WHERE id = $1
      `, [id]);
      if (result.rowCount > 0) {
        const r = result.rows[0];
        row = {
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
        };
      }
    } catch { /* legacy schema might not exist */ }

    // Fallback to public
    if (!row) {
      const result = await pool.query(`
        SELECT id, title, slug, description, category, cover_image,
               video_url, date, location, featured, published,
               sort_order, created_at, updated_at
        FROM public.projects WHERE id = $1
      `, [id]);
      if (result.rowCount > 0) {
        const r = result.rows[0];
        row = {
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
        };
      }
    }

    if (!row) return res.status(404).json({ error: 'Prosjekt ikke funnet' });
    return res.status(200).json(row);
  } catch (error) {
    console.error('Project detail error:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}
