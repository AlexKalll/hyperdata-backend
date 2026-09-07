# Changes
This file documents modifications made to the upstream project in compliance with
Section 4(b) of the Apache License, Version 2.0.

## Upstream

- **Original project:** [Dave-lab12/leyu-backend](https://github.com/Dave-lab12/leyu-backend)
- **License:** Apache License 2.0
- **Fork:** [iCog-Labs-Dev/hyperdata-backend](https://github.com/iCog-Labs-Dev/hyperdata-backend)

The upstream `LICENSE` file is retained unmodified in the repository root.
Any copyright headers present in upstream source files are preserved.

## Modifications

All changes made in this fork relative to the upstream `mahder-backend` are
tracked in the Git history of this repository. The list below summarizes the
notable categories of modification; consult `git log` for the authoritative
record.

### Bootstrap, error handling, and configuration safety

- Removed a duplicate `ProjectModule` registration from `AppModule`.
- Registered `AllExceptionsFilter` globally and added consistent formatting for
  array-style validation errors.
- Sanitized credential-bearing URLs (Database, Redis, RabbitMQ) in startup logs.
- Blocked wildcard `CORS_ORIGIN` in production and tightened CORS configuration
  (explicit methods, allowed headers, credentials).
- Removed a stray `console.log` of the database URL from `src/database/data-source.ts`.
- Expanded `.env.example` with previously undocumented variables
  (`NODE_ENV`, `AFRO_SMS_API_KEY`, `AFRO_SMS_API_SECRET`, `CORS_ORIGIN`,
  `LOG_LEVEL`).

### Documentation

- Updated `README.md` to reflect the Apache 2.0 license and upstream attribution.
- Added this `CHANGES.md` file.

## 2026-08-10

### Authorization hardening
- Restricted blog mutations and contact-submission staff access to administrators,
  while retaining public contact form submission and blog reads.
- Restricted reference-data administration to authenticated administrators.
- Scoped contributor dataset deletion to its owner and restricted review decisions
  to assigned, unexpired reviewer work items.
- Enforced project-manager ownership for project operations and task-derived
  management routes, and limited manager reassignment to super-administrators.
- Bound text and audio submissions to microtasks from the requested task and to
  the contributor's assigned work list.
- Updated dataset service test doubles for reviewer-assignment enforcement.

### Authentication hardening
- Rejected inactive accounts during JWT and refresh-token authentication.
- Added rotating, revocable opaque refresh sessions backed by persistent storage.
- Replaced predictable OTPs with CSPRNG-generated, HMAC-protected, single-use
  codes with transactional attempt exhaustion.
- Enabled strict request property whitelisting and replaced self-service profile
  mass assignment with an explicit update allowlist.
- Added fail-closed Redis throttling for authentication, signup, and verification
  endpoints, with explicit trusted-proxy hop configuration.
- Added atomic refresh rotation, password-reset revocation, and cleanup of expired
  or old revoked sessions.
- Added short-lived onboarding-only tokens and revoked active sessions when
  passwords change or accounts are disabled.
### Production containment and infrastructure access
- Disabled test event endpoints and the Bull Board queue administration UI in production.
- Restricted task redistribution to platform administrators.
- Disabled withdrawals by default and introduced configuration validation for the
  withdrawal and payment-provider settings.
- Removed public Docker port mappings for PostgreSQL, Redis, RabbitMQ, and the
  RabbitMQ management UI; added Redis authentication and non-default RabbitMQ
  credentials for the private application network.
- Added a credential-rotation runbook for local infrastructure and external
  payment, SMS, and email providers.

### Financial integrity
- Added validated withdrawal amounts, atomic wallet reservations, payout state
  tracking, ES256 Santim Pay request signing, and scheduled provider-status
  reconciliation.
- Added migration-level constraints for valid ledger signs, non-negative wallet
  balances, non-negative task payment rates, and unique provider references.
- Prevented task payment-rate changes after task distribution starts.
- Made dataset wallet credits idempotent by locking the dataset row and recording
  contributor/reviewer payment completion in the same transaction as the ledger
  credit.
- Added unit coverage for payout signing and withdrawal reservation validation.

### CI / deployment pipeline
- Replaced placeholder unit-test and lint jobs in `.gitlab-ci.yml` with real
  `npm ci` + `npm run test` / `npm run lint` invocations.
- Fixed the `push_image` job name typo to `push_image`.
- Parameterized the deploy SSH target via `DEPLOY_HOST` / `DEPLOY_USER`
  environment variables instead of a hard-coded IP.
- Added a post-deploy `/api/health` smoke-test job.
- Added full-project typecheck gate to the CI pipeline.
- Pinned npm to v10 in CI workflows and via packageManager.
- Synced npm lockfile with package manifest for CI compatibility.
- Enabled manual triggering of CI workflow with `workflow_dispatch`.
- Fixed CI environment variables and references from Leyu to Mahder.

* **PR #1**: Added unit tests for auth and dataset flows
  - Added unit coverage for auth and dataset flows
  - Added unit test summary for reviewers
  - Fixed test import and e2e spec targets
* **PR #2**: Fixed codebase issues phase 1
  - Optimized Dockerfile with cache mount for npm installs
  - Updated cmd so app starts even if migrations fails
  - Fixed Docker compose file syntax
* **PR #3**: Fixed GitLab CI cleanup
  - Replaced GitLab CI jobs with GitHub Actions equivalents
  - Added npm ci and test/lint invocations
* **PR #5**: Added GitHub Actions CI pipeline, fixed lint problems and hardened checks
  - Migrated from `.gitlab-ci.yml` to GitHub Actions workflow (`/.github/workflows/ci.yml`)
  - Added CI workflow configuration with typecheck, test, and lint gates
  - Updated environment variables and references from Leyu to Mahder
  - Added seed data for roles, countries, regions, rejection types, and test users
* **PR #6**: Fixed lock-file, lint and typecheck failures from latest dev changes
  - Updated `package-lock.json` and `package.json` for npm v10 compatibility
  - Fixed various service module imports and specifications
  - Resolved lint and typecheck errors across auth, cache, data_set, task_distribution modules
* **PR #7**: Fixed backend docker setup reliably, fixed login, and seed demo users
  - Optimized Dockerfile with cache mount for npm installs
  - Fixed app service startup even if migrations fail
  - Changed RabbitMQ condition from `service_healthy` to `service_started`
  - Added audio duration registering for speech datasets in seconds
* **PR #11**: Rebranded to Mahder across all modules
  - Updated `.env.example`, `README.md`, `docker-compose.yaml`, `package-lock.json`, `package.json`
  - Renamed Swagger title from Leyu to Mahder
  - Updated `src/app.module.ts` and package configuration
* **PR #12**: Fixed Docker API access
  - Fixed Docker Compose API access configuration
* **PR #13**: Fixed Redis health check
  - Improved Redis and health check reliability

### Docker and infrastructure
- Hardened Dockerfile for production with security improvements.
- Fixed compose orchestration and blocked secret exposure.
- Produced clean prod image via Dockerfile (instead of pulling image).
- Fixed Dockerfile command syntax to use `&&` for chaining commands.
- Enabled MinIO compose service with bucket initialization.
- Configured manual triggering of CI workflow with `workflow_dispatch`.

### Seed and test data
- Removed 'Admin' users from test data in seeder.
- Updated default system admin credentials.
- Added test account section to README.
- Simplified error handling and improved code readability across services and controllers.
- Updated seed scripts to use upsert method and cleaned up hardcoded super admin creation logic.

### TypeScript and configuration
- Replaced deprecated `baseUrl` with `paths` and pinned global type packages.
- Simplified type assertions and fixed lint errors.
- Regenerated lockfile with npm 10 for CI compatibility.
- Updated project statistics service to return default values instead of throwing
  exceptions for missing projects.

### Code quality and readability
- Improved code formatting across multiple files.
- Simplified error handling in various services and controllers.
- Cleaned up GitLab CI configuration and added GitHub Actions CI pipeline.
- Ran checks and parameterized deploy host.
- Optimized Dockerfile with cache mount for npm installs.

### Branding
- Renamed from Leyu and/or hyperdata to Mahder.

## 2026-08-19 - File upload integration
- Replaced `multer-s3` (incompatible with `@aws-sdk/client-s3` v3) with a custom
  `S3Storage` class that uses `@aws-sdk/lib-storage` `Upload` for multipart-aware
  streaming uploads to MinIO/S3.
- Fixed `forcePathStyle` configuration: the environment string `"true"` was passed
  directly to `S3Client` (expected boolean), causing DNS resolution against virtual-host
  style endpoints (`bucket.minio`) instead of path-style (`minio/bucket`).
- Removed spurious `'error'` event listener on the `Upload` object that fired
  non-fatal streaming warnings, which prematurely rejected the multer callback with
  an `undefined` error.
- Wrapped non-critical side-effects (`emailService.sendEmail`,
  `activityLogService.create`) in `.catch()` handlers inside the project creation
  transactional flow to prevent email failures from aborting the transaction.

## 2026-08-26 - ProjectManager tasks access fix & local DB tooling from docker-containers

### Authorization fix (`ProjectScopeGuard`)
- Fixed the guard resolving the generic `:id` route param as a **task ID** on
  project-scoped routes (`GET /project-mgmt/task/project/:id`, `/all`,
  `/archived/:id`), where `:id` is actually a **project UUID**.
- Previously this caused every Project Manager request for their project's task
  list to fail with `403 "Task is not available"` (tasks could be created but never listed).
- The guard now only falls back to `:id` when the request path is not a
  `/project/…` route; explicit `task_id` params and true task routes
  (`/:id`, `/:id/members`, …) still enforce manager ownership as before.

### Docker / infrastructure
- Added an `adminer` service to `docker-compose.yaml` (port `5555:8080`) for local database management; waits on the `postgres` healthcheck and joins the private application network.
- Simply it added adminer container to docker-compose for DB inspection

## 2026-09-06 - Complete demo user profiles

### Seed and test data

- Expanded the existing test-user seed with complete Amharic profiles, Ethiopian location data, unique phone numbers, and active states for new and existing demo users.
- Ensure contributor/reviewer wallets and linked scores exist without resetting earned balances or scores on reruns. Projects, tasks, assignments, and submissions remain manual UI operations.

## 2026-09-07 - End-to-end workflow corrections

### Validation and submissions

- Added strict nested validation for text submission attempts and compatible validation metadata for annotation/rejection reference-data DTOs.
- Validate prior submissions per microtask with their statuses so rejected work can be retried without accepting duplicate pending/approved work.
- Advance contributor progress by newly submitted microtasks rather than configured batch size; retries do not increment progress or renew deadlines. Added text/audio regression coverage.

### Finance

- Corrected two-decimal withdrawal validation to accept legitimate floating-point amounts such as 0.29.
- Added mocked-provider coverage for reservation, settlement, ambiguous transport errors, insufficient balance, and idempotent failure reversal. Real payouts remain disabled during E2E verification.

## How to record future changes

When making non-trivial modifications, add a short entry under a new dated
section below (or extend an existing category) so downstream users can identify
what diverges from upstream.

## Commit policy

- Before committing implementation changes, record a concise, dated summary in
  this file.
- Split commits by cohesive behavior or deployable concern, and use Conventional
  Commit messages such as `fix(finance): reserve payout funds atomically`.
- Do not include documentation-only files in implementation commits. The sole
  exception is this file, which may be committed separately to record the
  corresponding modifications.
<!--
## YYYY-MM-DD - 
- description of change
-->
