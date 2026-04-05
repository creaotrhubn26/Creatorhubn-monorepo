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

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5050/auth/google/callback

# The Role Room Agent (OpenAI)
OPENAI_API_KEY=your-openai-api-key
ROLE_ROOM_AGENT_MODEL=gpt-5.4-mini

# Tripletex testmiljø (valgfritt, men nødvendig for regnskapsflyt)
TRIPLETEX_TEST_BASE_URL=https://api-test.tripletex.tech/v2
TRIPLETEX_TEST_CONSUMER_TOKEN=your-consumer-token
TRIPLETEX_TEST_EMPLOYEE_TOKEN=your-employee-token
# Optional expiration date in YYYY-MM-DD
TRIPLETEX_TEST_SESSION_EXPIRATION_DATE=2030-01-01
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
