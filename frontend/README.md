# CreatorHub Norge - Frontend

React 18 + TypeScript + Vite frontend for CreatorHub Norge creator management platform.

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** TailwindCSS + Material-UI
- **State Management:** Zustand + React Query
- **Routing:** React Router v7

## Development

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Deployment

Deployed to Vercel. Configure environment variables in Vercel dashboard:
- `VITE_API_URL` - Backend API URL

## Project Structure

```
client/               # React application source
shared/              # Shared types with backend
vite.config.ts       # Vite configuration
tsconfig.json        # TypeScript configuration
```
