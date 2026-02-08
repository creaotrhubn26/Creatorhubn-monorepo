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
    // Forward to Render backend for bcrypt password verification
    const renderResp = await fetch('https://wedflow-api.onrender.com/api/couples/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await renderResp.json();
    return res.status(renderResp.status).json(data);
  } catch (error) {
    console.error('Couples login error:', error);
    return res.status(500).json({ error: 'Innlogging feilet' });
  }
}
