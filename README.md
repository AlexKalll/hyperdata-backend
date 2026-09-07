# Mahder API

Mahder API is a NestJS backend for managing crowdsourced data collection, annotation, review, task distribution, contributor payments, notifications, and operational reporting.

The system is designed around projects, tasks, micro-tasks, contributors, reviewers, facilitators, project managers, and administrators. It includes the infrastructure needed to run the platform locally or in containers: PostgreSQL, Redis, RabbitMQ, BullMQ, MinIO/S3-compatible storage, email, SMS, push notifications, and Santim Pay integration.

## Features

### Authentication, Users, and Access Control

- JWT login, mobile login, refresh tokens, password reset, OTP verification, and role lookup.
- User registration, admin-created users, profile updates, password changes, verification, activation toggles, and current-user profile retrieval.
- Role-focused user listing for project managers, reviewers, contributors, and facilitators.
- Role and permission guards for protected routes.
- User scores and score logs for performance/reputation workflows.
- User device token support for push notifications.

### Project Management

- Project CRUD with archive/unarchive support.
- Project manager assignment and project-member retrieval.
- Manager-specific project views, including paginated and complete lists.
- Project invitation links for projects and tasks.
- Invitation acceptance flow.
- Project-level statistics and dataset progress reporting.

### Task Management

- Task CRUD with archive/unarchive and close/reopen support.
- Task type CRUD.
- Task requirements, payment configuration, and instruction management.
- Assignment of facilitators, reviewers, and contributors to tasks.
- Contributor assignment to facilitators.
- Automatic contributor assignment to facilitators.
- Task member listing, activation toggles, removal, and member flagging.
- Import contributors from another task.
- Export task contributors.
- Discover unassigned users and users matching task requirements.
- Role-specific task views for contributors, reviewers, and facilitators.

### Micro-task and Dataset Workflows

- Micro-task CRUD.
- CSV import and export for micro-tasks.
- Import micro-tasks from another task.
- Audio and bulk-audio micro-task upload.
- Contributor micro-task views and submission history.
- Dataset CRUD and dataset review flows.
- Dataset approval and rejection with rejection reasons.
- Contributor, reviewer, task, micro-task, and facilitator-specific dataset views.
- Dataset assignment and submission tracking.
- Dataset action publishing through RabbitMQ.
- File upload processing through background queues.

### Task Distribution

- Contributor task assignment and "my tasks" retrieval.
- Reviewer task assignment.
- Contribution submission for text/data tasks.
- Audio contribution submission.
- Contributor micro-task submission retrieval.
- Task redistribution support.
- Task distribution monitoring by task, contributor, micro-task, reviewer assignment, and reviewer progress.
- Micro-task statistics and reviewer task progress tracking.

### Review and Quality Control

- Review workflow for assigned datasets and reviewer task queues.
- Rejection reason management.
- Base rejection type management.
- Flag type management.
- Member flagging on tasks.
- Dataset and micro-task status constants for workflow control.
- Activity logs for traceability and audit history.

### Base Data and Settings

- Country, region, and zone management.
- Language and dialect management.
- Organization and sector management.
- Annotation type and dataset annotation management.
- Flag type and rejection type management.
- Paginated and complete list endpoints for settings data where supported.
- Seed data for roles, countries, regions, and rejection types.

### Finance and Payments

- User wallet balance retrieval.
- Withdrawal requests.
- Transaction listing.
- Score value retrieval and update.
- Santim Pay configuration support.
- Task payment configuration and contributor compensation workflows.

### Communication and Content

- Contact-us CRUD.
- Blog CRUD.
- SMS service integration.
- Email service integration through Nodemailer/Gmail.
- Notification retrieval for the current user.
- New-notification count endpoint.
- Firebase Admin SDK dependency for push-notification support.
- RabbitMQ publisher service for event-style notifications.

### Statistics and Reporting

- Super-admin dashboard statistics.
- Super-admin dataset contribution statistics.
- Dataset language statistics.
- Project statistics.
- Task statistics.
- Project and task dataset statistics.
- Reviewer statistics.
- Task distribution monitoring dashboards.

### Files, Media, and Storage

- MinIO/S3-compatible object storage integration.
- Public image/file retrieval endpoint.
- Audio metadata support for uploaded audio files.
- File upload queue using BullMQ and Redis.
- Background file upload processor.
- Cache management endpoint for clearing cache state.

### Platform and Operations

- PostgreSQL database with TypeORM entities, migrations, and seeds.
- Redis for caching and BullMQ queues.
- RabbitMQ for notification and dataset event queues.
- Bull Board queue dashboard at `/admin/queues`.
- Swagger/OpenAPI documentation.
- Global request validation.
- Global response interceptor.
- Global HTTP exception filter.
- Request logging middleware.
- Config validation with Joi.
- CORS configuration with production safety checks.
- Health check endpoint.
- Docker and Docker Compose support.
- Unit and e2e test setup with Jest.

## Architecture

### Core Modules

- `AuthModule` - authentication, users, roles, permissions, scores, verification codes, and device tokens.
- `ProjectModule` - projects, tasks, task types, task instructions, task payments, requirements, invitation links, and facilitator/contributor assignments.
- `DataSetModule` - datasets, micro-tasks, rejection reasons, flag reasons, imports, exports, and audio upload flows.
- `TaskDistributionModule` - contributor assignments, reviewer assignments, contribution submission, redistribution, reviewer progress, and monitoring.
- `FinanceModule` - wallets, transactions, score values, and payment gateway services.
- `CommunicationModule` - blog and contact-us features.
- `CommonModule` - files, audio helpers, notifications, activity logs, RabbitMQ publishing, pagination, interceptors, and filters.
- `BaseDataModule` - countries, regions, zones, languages, dialects, organizations, sectors, annotation types, flag types, and rejection types.
- `StatisticsModule` - super-admin, project, and reviewer reports.
- `CacheModule` - Redis-backed cache utilities and cache clearing.
- `BackgroundTaskModule` - background consumers and file upload processing.
- `HealthModule` - service health checks.
- `SmsModule` and `EmailModule` - messaging integrations.

### Technology Stack

- NestJS 11 and TypeScript
- PostgreSQL with TypeORM
- Redis with BullMQ
- RabbitMQ
- Bull Board
- JWT and Passport
- CASL/nest-casl dependencies for authorization workflows
- MinIO/S3-compatible storage with AWS SDK clients
- Nodemailer and Nest mailer
- Firebase Admin SDK
- Santim Pay integration
- Swagger/OpenAPI
- Joi, class-validator, and Zod/nestjs-zod
- Jest and Supertest
- Docker and Docker Compose

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL 12 or newer, or Docker Compose
- Redis 7 or newer, or Docker Compose
- RabbitMQ, or Docker Compose
- MinIO or another S3-compatible service for file upload/storage flows

## Installation

1. Clone the repository.

   ```bash
   git clone <repository-url>
   cd mahder-backend
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Create an environment file.

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Update `.env` for your local services.

   Required configuration includes:

   ```env
   PORT=3000
   NODE_ENV=development

   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_jwt_refresh_secret
   JWT_EXPIRES_IN=24h
   JWT_REFRESH_EXPIRES_IN=7d

   DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/mahder_db
   DATABASE_SCHEMA=public

   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_URL=redis://localhost:6379

   RABBITMQ_URI=amqp://guest:guest@localhost:5672
   RABBITMQ_QUEUE_NAME=notifications.queue
   RABBITMQ_EXCHANGE_NAME=notifications.exchange
   RABBITMQ_EXCHANGE_TYPE=topic
   RABBITMQ_ROUTING_KEY=notification.created
   RABBITMQ_DURABLE=true

   DATASET_RABBITMQ_EXCHANGE_NAME=dataset.exchange
   DATASET_RABBITMQ_QUEUE_NAME=dataset.queue
   DATASET_RABBITMQ_ROUTING_KEY=dataset.action

   SMS_BASE_URL=https://sms.com/api
   SMS_IDENTIFIER=your_SMS_IDENTIFIER
   SMS_SENDER=YourSenderName
   SMS_TOKEN=your_sms_token

   MINIO_ENDPOINT=http://localhost:9000
   MINIO_ROOT_USER=minio_root_admin
   MINIO_ROOT_PASSWORD=replace_with_a_long_random_root_password
   MINIO_ACCESS_KEY=mahder_app_storage
   MINIO_SECRET_KEY=replace_with_a_long_random_app_password
   MINIO_BUCKET=mahder-bucket
   MINIO_S3_FORCE_PATH_STYLE=true
   MINIO_SIGNATURE_VERSION=v4

   EMAIL_USER=your_email@example.com
   EMAIL_PASS=your_email_app_password
   ```

5. Run migrations and seeds.

   ```bash
   npm run migration:run
   npm run seed
   ```

## Development

Run the API in watch mode:

```bash
npm run start:dev
```

Run in debug mode:

```bash
npm run start:debug
```

Run the compiled production build:

```bash
npm run build
npm run start:prod
```

The API uses the global prefix `/api`.

- API base URL: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/doc`
- Health check: `http://localhost:3000/api/health`
- Bull Board: `http://localhost:3000/admin/queues`

## Docker

Docker Compose starts:

- `postgres`
- `redis`
- `rabbitmq`
- `minio`
- `minio-init`
- `app`

Start the full stack:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f
```

Stop services:

```bash
docker compose down
```

Remove containers and volumes:

```bash
docker compose down -v
```

RabbitMQ management UI is available at `http://localhost:15672` with the default local credentials `guest / guest`.

MinIO is available to containers at `http://minio:9000`. For local host access, the API and console bind to `127.0.0.1:9000` and `127.0.0.1:9001` by default. The `minio-init` job creates the configured bucket and app-scoped storage user before the API starts.

See [RUN_BACKEND.md](RUN_BACKEND.md) for the detailed Docker runbook.

## Database and Seeds

```bash
# Generate a migration from entity changes
npm run migration:generate

# Create an empty migration
npm run migration:create

# Run migrations
npm run migration:run

# Show migration state
npm run migration:show

# Revert the latest migration
npm run migration:revert

# Run seeds
npm run seed

# Create a seed
npm run seed:create
```

Seed files currently include initial roles, countries, regions, and rejection types.

## Testing and Code Quality

```bash
# Unit tests
npm run test

# Unit tests in watch mode
npm run test:watch

# Test coverage
npm run test:cov

# End-to-end tests
npm run test:e2e

# Lint and auto-fix
npm run lint

# Format source and tests
npm run format
```

## Main API Areas

All routes are served under `/api`.

| Area | Route prefix examples | Capabilities |
| --- | --- | --- |
| Authentication | `/iam/auth` | Login, mobile login, refresh token, password reset, OTP verification, roles |
| Users | `/iam/users` | User CRUD, sign-up, profile, activation, role-based lists |
| Projects | `/project-mgmt/project` | Project CRUD, archive, manager assignment, members |
| Tasks | `/project-mgmt/task` | Task CRUD, assignments, requirements, payments, instructions, members, close/archive |
| Task Types | `/project-mgmt/task-type` | Task type CRUD |
| Facilitators | `/project-mgmt/task/facilitator` | Facilitator contributor assignment and listing |
| Invitation Links | `/project-mgmt/invitation-link` | Project/task invite creation, lookup, and acceptance |
| Micro-tasks | `/workspace/micro-task` | Micro-task CRUD, CSV import/export, audio upload, submissions |
| Datasets | `/workspace/data-set` | Dataset CRUD, contributor/reviewer/facilitator views, approve/reject |
| Rejection Reasons | `/workspace/rejection-reason` | Rejection reason CRUD |
| Task Distribution | `/task-distribution` | Assignment, contribution, audio contribution, reviewer assignment, redistribution |
| Distribution Monitoring | `/task-distribution-monitoring` | Task, contributor, micro-task, reviewer assignment, and reviewer progress stats |
| Settings | `/setting/*` | Countries, regions, zones, languages, dialects, organizations, sectors, annotations, flag types, rejection types |
| Finance | `/wallet`, `/transaction`, `/score-value` | Wallet balance, withdrawals, transactions, score values |
| Statistics | `/statistics/*` | Super-admin, project, task, dataset, language, and reviewer statistics |
| Notifications | `/notifications` | Current-user notifications and unread count |
| Activity Logs | `/activity-logs` | Current-user and user-specific activity logs |
| Communication | `/blog`, `/contact-us` | Blog and contact form CRUD |
| Cache | `/cache` | Cache clearing |
| Health | `/health` | Application health |

For exact request and response shapes, use Swagger at `/doc`.

## Test Accounts

Run these commands from the backend directory against a **local/development database only**.
In `.env`, enable the demo users:

```env
NODE_ENV=development
ENABLE_DEMO_USERS_SEED=true
```

**Native (without Docker):** with dependencies installed and `DATABASE_URL` pointing to a database reachable from your host:

```bash
npm run migration:run
npm run seed
```

**Docker:** rebuild to include the latest seed, then run the compiled scripts:

```bash
docker compose up -d --build
docker compose exec -T app npm run migration:run:prod
docker compose exec -T -e NODE_ENV=development -e ENABLE_DEMO_USERS_SEED=true app npm run seed:prod
```

All demo accounts use password `12345678`:

| Role | Accounts |
| --- | --- |
| SuperAdmin | `super@gmail.com`, `super1@gmail.com` |
| ProjectManager | `proj@gmail.com`, `proj1@gmail.com` |
| Facilitator | `faci@gmail.com`, `faci1@gmail.com` |
| Reviewer | `rev@gmail.com`, `rev2@gmail.com` |
| Contributor (mobile) | `cont@gmail.com`, `cont1@gmail.com` |

For mobile login, enter `123456789` or `234567890` in the phone field; the app adds `+251`.
The seed creates or updates demo profiles, but leaves project/task creation and assignment to the UI.
Never enable demo seeding against a production database.

## Operational Notes

- `NODE_ENV=production` cannot use `CORS_ORIGIN=*`; configure a concrete origin or comma-separated origin list.
- Docker Compose defines MinIO and an idempotent `minio-init` job for local object storage.
- The app validates required environment variables during startup with Joi.
- The app sanitizes database, Redis, and RabbitMQ credentials in startup logs.
- Production Docker startup runs compiled migrations before starting the API.

## Troubleshooting

### Database Connection Issues

- Confirm PostgreSQL is running.
- Confirm `DATABASE_URL` points to the right host and port.
- For Docker Compose, use `postgres` as the host inside `.env`; for host-machine local development against the Compose database, use `localhost:5433`.

### Redis Connection Issues

- Confirm Redis is running.
- Confirm `REDIS_HOST`, `REDIS_PORT`, and `REDIS_URL`.
- For Docker Compose, use `redis` as the host inside containers.

### RabbitMQ Connection Issues

- Confirm RabbitMQ is running.
- Confirm `RABBITMQ_URI`.
- For Docker Compose, use `rabbitmq` as the host inside containers.
- RabbitMQ management is available at `http://localhost:15672`.

### File Upload Issues

- Confirm `MINIO_ENDPOINT`, access key, secret key, and bucket.
- Confirm the bucket exists and the app can reach the object storage service.
- Confirm Redis is available because upload processing uses BullMQ.

### SMS, Email, or Notification Issues

- Confirm provider credentials and sender settings.
- Check provider rate limits.
- Check RabbitMQ configuration for notification publishing.
- Check logs for failed delivery attempts.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make changes with tests where appropriate.
4. Run linting and tests.
5. Open a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) for project policies.

## License & Attribution

This project is a fork of [Dave-lab12/leyu-backend](https://github.com/Dave-lab12/leyu-backend) and is distributed under the **Apache License, Version 2.0**. See the [`LICENSE`](./LICENSE) file for the full license text.

Modifications made in this fork are documented in [`CHANGES.md`](./CHANGES.md), in compliance with Section 4(b) of the Apache 2.0 License.

This fork is not affiliated with or endorsed by the upstream project. Apache 2.0 does not grant trademark rights to upstream names or logos.

## Support

For support and questions, please contact the development team or create an issue in the repository.
