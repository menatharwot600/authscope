# AuthScope

AuthScope is a controlled educational API authorization lab. It demonstrates Broken Object Level Authorization (BOLA) using only the app's local demo API and seeded synthetic Alice/Bob resources. It is not a general-purpose scanner and does not accept arbitrary target URLs.

## Stack

This workspace provides a TypeScript/Express API service and a PostgreSQL/Drizzle database rather than a Python/FastAPI/SQLAlchemy scaffold. AuthScope uses that supported stack for a fully working backend, plus React, TypeScript, Tailwind, Recharts, Lucide, and Replit-managed Clerk authentication. The database uses the project's provisioned PostgreSQL service rather than local SQLite so saved runs remain persistent in the hosted app.

## Run locally in Replit

1. Ensure the project database is available and Clerk Auth is enabled for the app.
2. Apply the development schema:

   ```sh
   pnpm --filter @workspace/db run push
   ```

3. Start the API server and the AuthScope web workflow from the Replit Run controls. The API seeds the secure lab configuration and synthetic resources `101` (Alice) and `202` (Bob) idempotently at startup.
4. Open the web preview, register or sign in through Clerk, then go to **Security Lab**.

The API contract and interactive Swagger reference are available at `/api/openapi.json` and `/api/docs`.

## Quality checks

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run test
```

The Node test suite checks the core authorization policy: owner access, the isolated vulnerable cross-user read, secure-mode denial, and cross-user write/delete denial.

## Environment

Replit provisions the development and production database and Clerk credentials. `.env.example` lists variable names with placeholders only. Never paste a live Clerk secret into frontend code. The browser uses Clerk's session cookie; the API derives the platform user from the verified session.

## Security model

- All application API routes other than health and public API documentation require Clerk authentication.
- AuthScope's own test history, findings, and audit events are scoped to the authenticated Clerk user.
- The `X-Demo-User` header only selects Alice or Bob inside the synthetic lab. It is not a platform identity and cannot bypass the requirement for a real authenticated session.
- Vulnerable mode intentionally omits ownership validation only for synthetic resource detail reads. Resource listing, create, update, delete, real account handling, and all app administration remain protected.
- Test execution runs a fixed suite against in-process policy functions. It never accepts a URL, hostname, or user-supplied target.
- Reports redact credential-like values and are available only to the run's owner.

## Deployment

The web artifact builds to static files; the shared API Server artifact runs the Express service and uses the provisioned PostgreSQL database. Publish through Replit after reviewing the production database and Clerk configuration. This repository contains deployment-ready configuration but has not been published.

## Deploy on Render (free, no credit card)

See [`DEPLOY_RENDER.md`](./DEPLOY_RENDER.md). One free Render web service serves both the API and the built web app; Postgres comes from Neon and auth from Clerk (both free, no card).
