# AuthScope

An educational API authorization lab that demonstrates BOLA only against its own synthetic demo resources.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run test` — run authorization policy unit tests
- Required env: `DATABASE_URL` and provisioned Clerk keys

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Web app: `artifacts/authscope`
- API routes: `artifacts/api-server/src/routes`
- Authorization engine: `artifacts/api-server/src/lib/authscope-lab.ts`
- Persistent tables: `lib/db/src/schema/authscope.ts`
- API contract: `lib/api-spec/openapi.yaml`
- User-facing guide and Swagger UI: `/docs` and `/api/docs`
- Sample report and presentation outline: `docs/`

## Architecture decisions

- AuthScope uses the workspace's Express, Drizzle, and PostgreSQL stack rather than introducing a second Python/FastAPI service.
- Clerk owns platform registration and sessions; Alice and Bob are synthetic lab identities available only on fixed local demo endpoints.
- Vulnerable mode omits ownership validation for synthetic detail reads only; mutations and platform data remain protected.
- Each Clerk user's runs, findings, and audit events are scoped to their authenticated user ID.

## Product

Users can exercise the lab policy, review findings, compare vulnerable and secure outcomes, inspect history and audit events, manage synthetic resources, and export reports.

## User preferences

- All application content is English.
- Never add arbitrary URL scanning or third-party test targets.

## Gotchas

- Keep the OpenAPI spec and generated client/Zod schemas in sync with `pnpm --filter @workspace/api-spec run codegen`.
- Seed data is synthetic and initialized idempotently; schema changes use the development-only Drizzle push command.
- Web API calls use Clerk's same-origin session cookie, not a browser-managed bearer token.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- See `README.md` for setup instructions and security scope.
