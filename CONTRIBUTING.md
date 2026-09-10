# Contributing

This monorepo uses npm workspaces with `frontend` and `backend`.

## Prerequisites

Node >=20.0.0

## Install dependencies

The root manifest defines an install script:

```bash
npm run install:all
```

`install:all` runs `npm install` at the root and then installs dependencies in `frontend` and `backend`.

## Lint

Frontend
```bash
npm --prefix frontend run lint
```
Script defined in `frontend/package.json`: `eslint . --ext .ts,.tsx --fix`

Backend
```bash
npm --prefix backend run lint
```
Script defined in `backend/package.json`: `eslint . --ext .ts --fix`

## Typecheck

Frontend
```bash
npm --prefix frontend run typecheck
```
Script defined in `frontend/package.json`: `tsc --noEmit`

Backend
```bash
npm --prefix backend run typecheck
```
Script defined in `backend/package.json`: `tsc --noEmit`

## Tests

Frontend unit tests
```bash
npm --prefix frontend run test:unit
```
Script defined in `frontend/package.json`: `vitest run --config vitest.config.ts client/src/components/story-arc-studio`

Backend unit tests
```bash
npm --prefix backend run test:unit
```
Script defined in `backend/package.json`: `vitest run --config vitest.config.ts`
