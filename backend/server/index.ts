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

// Community API endpoints - stub implementations
app.get('/api/community/user/:userId/groups', (req, res) => {
  res.json([]);
});

app.get('/api/community/user/:userId/channels', (req, res) => {
  res.json([]);
});

app.get('/api/community/user/:userId/badges', (req, res) => {
  res.json({ badges: [] });
});

app.get('/api/community/user/:userId/roles', (req, res) => {
  res.json({ roles: [] });
});

app.get('/api/community/user/:userId/stats', (req, res) => {
  res.json({ stats: { messages: 0, reactions: 0, solutions: 0 } });
});

app.get('/api/community/channels/:channelId/messages', (req, res) => {
  res.json([]);
});

app.get('/api/community/messages/:messageId/thread', (req, res) => {
  res.json({ messages: [] });
});

app.get('/api/community/onboarding/:profession', (req, res) => {
  res.json({ 
    success: true, 
    config: {
      welcomeText: 'Velkommen til community!',
      completionText: 'Takk for at du fullførte onboarding!',
      steps: []
    }
  });
});

app.get('/api/community/mentors', (req, res) => {
  res.json([]);
});

app.get('/api/community/mentors/check-eligibility', (req, res) => {
  res.json({ eligible: false });
});

app.get('/api/community/notifications/:userId/unread-count', (req, res) => {
  res.json({ count: 0 });
});

app.get('/api/community/notifications/:userId/preferences', (req, res) => {
  res.json({ 
    notificationsEnabled: true,
    soundEnabled: true,
    emailNotifications: false
  });
});

app.post('/api/community/notifications/:userId/preferences', (req, res) => {
  res.json({ success: true });
});

app.get('/api/community/unanswered', (req, res) => {
  res.json([]);
});

app.get('/api/community/bookmarks', (req, res) => {
  res.json([]);
});

app.post('/api/community/bookmarks/:messageId', (req, res) => {
  res.json({ success: true });
});

app.delete('/api/community/bookmarks/:messageId', (req, res) => {
  res.json({ success: true });
});

app.get('/api/users/:userId', (req, res) => {
  res.json({ 
    id: req.params.userId,
    name: 'User',
    email: 'user@example.com'
  });
});

app.get('/api/user-kv/:userId/:key', (req, res) => {
  res.json({ value: null });
});

app.post('/api/user-kv/:userId/:key', (req, res) => {
  res.json({ success: true });
});

app.get('/api/user/preferences/tutorial/:id', (req, res) => {
  res.json({ dismissed: false, progress: {} });
});

app.post('/api/user/preferences/tutorial-dismissal', (req, res) => {
  res.json({ success: true });
});

app.patch('/api/user/preferences/tutorial/:id/progress', (req, res) => {
  res.json({ success: true });
});

// Catch-all for unhandled API routes
app.all('/api/*', (req, res) => {
  res.json({ message: 'Endpoint not implemented', path: req.path });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});
