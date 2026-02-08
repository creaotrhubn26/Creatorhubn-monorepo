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

  try {
    // Get upcoming projects (events in the future or recently)
    const result = await pool.query(`
      SELECT id, name, title, date, event_date, location, status, client_email, user_id
      FROM legacy.projects
      WHERE status = 'active'
      ORDER BY COALESCE(event_date, date, created_at::text) DESC
      LIMIT 10
    `);

    const projects = result.rows.map(r => ({
      id: r.id,
      name: r.name || r.title,
      title: r.title || r.name,
      date: r.date || r.event_date,
      eventDate: r.event_date || r.date,
      location: r.location,
      status: r.status,
      clientEmail: r.client_email,
      userId: r.user_id,
    }));

    return res.status(200).json(projects);
  } catch (error) {
    console.error('Upcoming projects error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
