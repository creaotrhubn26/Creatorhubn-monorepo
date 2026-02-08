function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Auth state is stored client-side in localStorage.
  // The session token doesn't have a server-side session store on Vercel,
  // so we just return not-authenticated and let the client use stored state.
  return res.status(200).json({ authenticated: false });
}
