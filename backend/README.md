# CreatorHub Norge - Backend

Node.js + Express + TypeScript backend for CreatorHub Norge creator management platform.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Passport.js + JWT
- **API:** RESTful + WebSocket

## Development

```bash
# Install dependencies
npm install

# Start development server (port 5050)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run typecheck

# Database operations
npm run db:push        # Push schema to database
npm run db:studio      # Open Drizzle Studio
```

## Environment Variables

Create `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Server
PORT=5050
NODE_ENV=development

# Auth
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5050/auth/google/callback
```

## Deployment

Deployed to Render. Configure environment variables in Render dashboard.

## Project Structure

```
server/              # Express application
shared/              # Shared types with frontend
scripts/             # Database and utility scripts
migrations/          # Database migrations
drizzle.config.ts    # Drizzle ORM configuration
```
