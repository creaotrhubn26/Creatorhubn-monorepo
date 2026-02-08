import pg from 'pg';
import crypto from 'crypto';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'E-post og passord er påkrevd' });
  }

  try {
    // Try bcrypt comparison if available, or forward to Render backend
    // For now, forward login to Render backend which has bcrypt
    const renderResp = await fetch('https://wedflow-api.onrender.com/api/couples/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await renderResp.json();

    if (!renderResp.ok) {
      return res.status(renderResp.status).json(data);
    }

    // Normalize the deployed response format
    if (data.couple && data.sessionToken) {
      return res.status(200).json({
        success: true,
        token: data.sessionToken,
        user: {
          id: data.couple.id,
          email: data.couple.email,
          name: data.couple.displayName || data.couple.email,
          role: 'couple',
          coupleProfileId: data.couple.id,
          displayName: data.couple.displayName,
        },
      });
    }

    // Pass through if already in the right format
    return res.status(200).json(data);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Innlogging feilet' });
  }
}
