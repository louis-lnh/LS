# SHD Portal Backend Foundation

This folder starts the shared backend implementation for the redesigned SHD portal.

Current scope:

- canonical data model SQL schema
- TypeScript domain types matching the schema
- PostgreSQL migration runner
- standalone HTTP API server
- first admin read endpoints
- first bridge endpoints

The schema is written for PostgreSQL. PostgreSQL is a better long-term fit than the current bot JSON store because the backend needs relational identity links, queryable support records, JSON payloads, audit logs, and append-only system heartbeats.

## Setup

```bash
cd shd-portal/backend
npm install
cp .env.example .env
npm run build
npm run migrate
npm start
```

Required env:

```text
DATABASE_URL=postgres://...
SHD_ADMIN_API_TOKEN=...
LIFESTEAL_WEBSITE_SERVICE_TOKEN=...
SHD_AGENT_LIFESTEAL_G17_SERVICE_TOKEN=...
```

Other bridge service tokens are declared in `src/service-auth.ts` and should be added before enabling those services.

## Implemented Runtime Endpoints

Admin:

- `GET /api/v1/health`
- `GET /api/v1/admin/events`
- `GET /api/v1/admin/events/:eventCodeOrId`
- `GET /api/v1/admin/systems`

Public:

- `GET /api/v1/public/events`

Bridge:

- `GET /api/v1/bridge/events/feed/:targetKey`
- `POST /api/v1/bridge/systems/heartbeat`

Bridge requests require:

```text
Authorization: Bearer <service-token>
X-SHD-Service: <service-key>
X-SHD-Request-ID: <stable-id>
```

## Next Runtime Slice

The next implementation slice should add:

1. `GET /api/v1/admin/systems/:systemKey`
2. `GET /api/v1/bridge/identity/minecraft/:minecraftUuid`
3. `POST /api/v1/bridge/anticheat/records`
4. migration/import script from the current Lifesteal bot JSON store

## Files

- `schema/001_initial.sql` - first shared backend schema
- `schema/002_seed_core.sql` - seed Lifesteal event and monitored systems
- `src/domain.ts` - shared TypeScript types for backend/API work
- `src/api-contract.ts` - first read API response contracts
- `src/bridge-contract.ts` - bridge request/response contracts for bots, Minecraft, websites, and SHD Agent
- `src/repositories.ts` - repository interfaces for the first database adapter
- `src/service-auth.ts` - bridge service keys, scopes, and header parsing helpers
- `src/routes.ts` - route registry for read and bridge endpoints
- `src/server.ts` - standalone HTTP server
- `src/migrate.ts` - migration runner
- `src/postgres-repositories.ts` - first PostgreSQL-backed read/write methods
- `docs/api-section-2-read-endpoints.md` - read endpoint design for admin/public/internal consumers
- `docs/api-section-3-bridge-contracts.md` - bridge endpoint design for existing services
