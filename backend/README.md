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

# Evendi bridge
EVENDI_API_URL=https://evendi.onrender.com

# Auth
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# Google OAuth / Workspace
CREATORHUB_GOOGLE_CLIENT_ID=your-creatorhub-google-client-id
CREATORHUB_GOOGLE_CLIENT_SECRET=your-creatorhub-google-client-secret
CREATORHUB_GOOGLE_REDIRECT_URI=http://localhost:5050/api/creatorhub/google/oauth/callback
ROLE_ROOM_GOOGLE_CLIENT_ID=your-role-room-google-client-id
ROLE_ROOM_GOOGLE_CLIENT_SECRET=your-role-room-google-client-secret
ROLE_ROOM_GOOGLE_REDIRECT_URI=http://localhost:5050/api/role-room/google/oauth/callback
ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY=your-role-room-google-token-secret
GOOGLE_PROJECT_ID=creatorhubn-com
GOOGLE_CLOUD_QUOTA_PROJECT=creatorhubn-com

# Legacy shared Google OAuth envs are deprecated and should not be used in production.
# Keep them only if an older local helper script still requires them during transition.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# The Role Room Agent (OpenAI)
OPENAI_API_KEY=your-openai-api-key
ROLE_ROOM_AGENT_MODEL=gpt-5.4-mini

# The Role Room Agent (retrieval + enrichment)
COHERE_API_KEY=your-cohere-api-key
GOOGLE_PLACES_API_KEY=your-server-side-google-places-api-key

# Tripletex testmiljø (valgfritt, men nødvendig for regnskapsflyt)
TRIPLETEX_TEST_BASE_URL=https://api-test.tripletex.tech/v2
TRIPLETEX_TEST_CONSUMER_TOKEN=your-consumer-token
TRIPLETEX_TEST_EMPLOYEE_TOKEN=your-employee-token
# Optional expiration date in YYYY-MM-DD
TRIPLETEX_TEST_SESSION_EXPIRATION_DATE=2030-01-01
```

## Deployment

Deployed to Render. Configure environment variables in Render dashboard.

For Google in production:

- use an `External` OAuth app in the `creatorhubn-com` Google Cloud project
- use a dedicated CreatorHub web client with:
  - `https://creatorhubn.com`
  - `https://creatorhubn.com/api/creatorhub/google/oauth/callback`
- use a dedicated The Role Room web client with:
  - `https://theroleroom.com`
  - `https://creatorhubn.com`
  - `https://theroleroom.com/api/role-room/google/oauth/callback`
  - `https://creatorhubn.com/api/role-room/google/oauth/callback`
- verify `creatorhubn.com` and `theroleroom.com` in Search Console
- keep production OAuth origins and redirects limited to live domains only
- use a server-side Google Places key for backend enrichment; browser/referrer keys will be rejected by backend requests

## Project Structure

```
server/              # Express application
shared/              # Shared types with frontend
scripts/             # Database and utility scripts
migrations/          # Database migrations
drizzle.config.ts    # Drizzle ORM configuration
```
