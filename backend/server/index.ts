import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints - return unauthenticated state
app.get('/api/auth/user', (req, res) => {
  res.json({ user: null, authenticated: false });
});

app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: false, user: null });
});

app.get('/api/auth/session-status', (req, res) => {
  res.json({ active: false, authenticated: false });
});

app.post('/api/auth/google/token', (req, res) => {
  res.json({ success: false, message: 'Google auth not configured' });
});

// Settings endpoints
app.get('/api/settings/demo-mode', (req, res) => {
  res.json({ enabled: true, demoMode: true });
});

app.get('/api/admin/gdpr-settings', (req, res) => {
  res.json({ 
    cookieConsentEnabled: false,
    dataRetentionDays: 365,
    gdprEnabled: true 
  });
});

app.get('/api/admin/profession-types', (req, res) => {
  res.json([
    { id: 'photographer', name: 'Fotograf', enabled: true },
    { id: 'videographer', name: 'Videograf', enabled: true },
    { id: 'music_producer', name: 'Musikk Produsent', enabled: true }
  ]);
});

// User KV store - return empty/default values
app.get('/api/user/kv/:key', (req, res) => {
  res.json({ value: null, key: req.params.key });
});

app.post('/api/user/kv/:key', (req, res) => {
  res.json({ success: true, key: req.params.key });
});

// Professions endpoints
app.get('/api/professions/all', (req, res) => {
  res.json([
    { 
      id: 'photographer', 
      name: 'Fotograf', 
      description: 'Profesjonell fotograf',
      features: ['Showcase Galleri', 'Klienthåndtering', 'Academy', 'Community'],
      enabled: true 
    },
    { 
      id: 'videographer', 
      name: 'Videograf', 
      description: 'Profesjonell videograf',
      features: ['StoryArc Studio', 'Smart Redigering', 'NLE-eksport', 'Academy'],
      enabled: true 
    },
    { 
      id: 'music_producer', 
      name: 'Musikk Produsent', 
      description: 'Profesjonell musikk produsent',
      features: ['Audio Suite', 'Mastering', 'Distribution', 'Academy'],
      enabled: true 
    }
  ]);
});

// Platform stats
app.get('/api/platform/stats', (req, res) => {
  res.json({
    totalUsers: 1250,
    activeProjects: 340,
    completedProjects: 890,
    totalRevenue: 0
  });
});

// Notifications
app.get('/api/notifications/active', (req, res) => {
  res.json([]);
});

// Analytics - accept and acknowledge
app.post('/api/analytics', (req, res) => {
  res.json({ success: true });
});

// Catch-all for unhandled API routes
app.all('/api/*', (req, res) => {
  res.json({ message: 'Endpoint not implemented', path: req.path });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});
