# StageStock Architecture Progress

## Current Layers

- `presentation`: screens + UI components + view-model hooks (`src/screens`, `src/components`, `src/ui/hooks`)
- `application`: orchestration/use-case services (`src/application/services`, `src/application/sync`)
- `infrastructure`: repositories + external sync adapters (`src/infrastructure/repositories`, `src/saas/services`)
- `domain`: business entities/rules represented by typed models and validation services (`src/types`, `src/lib/profileValidation`, `src/application/services/ValidationService.ts`)

## Production Systems Implemented

- Material tracking system (tour/location/assignment/activity log)
- Profile schema system (dynamic fields, validation, versioning)
- Offline-first queue sync (local-first + queued upserts)
- Conflict resolver (LWW + terminal tracking state protection)
- Periodic sync scheduler (30s when authenticated)
- Domain event bus for core lifecycle events (`src/application/events`)
- Pure-query helper test suites for bounded DB modules (`inventoryOpsQuery`, `userDbQuery`, `metadataDbQuery`, `loanDbQuery`)
- Integration DB test scripts available (`test:integration:db`, `test:integration:inventory`)

## Bounded DB Modules (Migration Status)

- `trackingDb`: extracted (tours, locations, assignments, activity logs, tracking snapshot, tracking sync markers)
- `profileDb`: extracted (profiles, schema versions, profile activation)
- `inventoryDb`: mostly extracted (materials/consumables reads+writes, alert queries for stock/VGP/maintenance)
- `loanDb`: mostly extracted (loan reads+writes, transitions, demand promotion/return/delete flows)
- `userDb`: extracted (local auth/session role lookup, PIN verification, user admin CRUD, Expo push token and notification recipient queries)
- `catalogDb`: extracted (categories tree/path, category CRUD with integrity checks, localisations CRUD)
- `metadataDb`: extracted (alert recipients, dashboard stats, loan beneficiaries directory CRUD)
- `inventoryOpsDb`: extracted (scanner lookups/search, stock adjustments/history, delete ops, NFC binding, material loan history, serie batch insert, VGP follow-up query)

## Remaining Direct `database.ts` Domains

- Sync low-level primitives (`getDB`, migration helpers) intentionally centralized under `src/db/coreDb.ts`
- Legacy niche inventory operations remain in `database.ts` as compatibility wrappers (`@deprecated`) while callers migrate.

## Next Refactor Targets

1. Stabilize and document `test:integration:db` execution context (RN-compatible runtime or resolver mocking).
2. Add integration-style tests for `inventoryOpsDb` side effects (stock/history writes, delete cascades, NFC binding updates).
3. Reduce compatibility wrappers in `database.ts` by progressively routing internal callers to bounded modules.
4. Add remote feature flags for gradual SaaS rollout.
5. Harden backend SaaS endpoints (auth/rate-limit/observability parity checks across routes).
