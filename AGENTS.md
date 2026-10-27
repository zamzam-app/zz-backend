# AGENTS.md — ZZ Backend

## Overview

**ZZ Backend** is the REST API server for the ZamZam ecosystem — a bakery/outlet management platform. It powers both a web admin dashboard and an iOS manager app (Expo/React Native). The backend handles outlets, products, reviews, tasks, user management, push notifications, and analytics.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | 20 (Alpine in Docker) |
| **Framework** | NestJS | 11.x |
| **Language** | TypeScript | 5.7+ |
| **Database** | MongoDB (Atlas) | via Mongoose 9.x |
| **Auth** | Passport + JWT | passport-jwt 4.x |
| **Push Notifications** | Expo Server SDK | 6.x |
| **SMS / OTP** | MSG91 | Custom integration |
| **File Uploads** | Cloudinary | 2.x |
| **API Docs** | Swagger (OpenAPI) | @nestjs/swagger 11.x |
| **Package Manager** | pnpm | 9.15+ |
| **Testing** | Jest + ts-jest | 30.x |

---

## Project Structure

```text
src/
├── main.ts                      # Entry point — CORS, global prefix (/api), ValidationPipe, Swagger
├── app.module.ts                # Root module — wires all feature modules
├── app.controller.ts            # Health-check / root endpoint
├── app.service.ts
│
├── common/
│   └── entities/
│       └── base.entity.ts       # BaseEntity with isActive + isDeleted (soft-delete pattern)
│
├── config/                      # Environment config
│
├── controller/                  # Feature modules (NestJS module per domain)
│   ├── auth/                    # JWT auth, login, OTP verification, refresh tokens
│   ├── users/                   # User CRUD, push token management, password changes
│   ├── outlet/                  # Outlet (store/branch) management
│   ├── outlet-type/             # Outlet type categories
│   ├── outlet-table/            # QR table management for outlets
│   ├── product/                 # Product catalog
│   ├── category/                # Product categories
│   ├── review/                  # Customer reviews + complaint system
│   ├── question/                # Review form questions
│   ├── forms/                   # Review form templates
│   ├── task/                    # Task management (event-sourced)
│   │   ├── task.service.ts      # Task CRUD
│   │   ├── task-reminder.service.ts  # Cron-based deadline reminders
│   │   └── services/
│   │       ├── task-event.service.ts       # Event log (append-only)
│   │       ├── task-delegation.service.ts  # Task delegation/reassignment
│   │       └── task-attachment.service.ts  # File attachments
│   ├── task-category/           # Task categories
│   ├── analytics/               # Dashboard analytics
│   ├── upload/                  # Cloudinary file upload
│   ├── cake-visualiser/         # Cake customisation visualiser
│   ├── cake-customization/      # Cake customisation options
│   ├── custom-cake/             # Custom cake orders
│   ├── uploaded-cakes/          # User-uploaded cake images
│   └── address/                 # Address management
│
├── integrations/
│   └── msg91/                   # MSG91 SMS/OTP integration
│
├── notifications/
│   ├── notifications.module.ts  # Notification module
│   └── notifications.service.ts # Expo push notification sender
│
└── util/                        # Shared utilities (password hashing, normalisation, etc.)
```

---

## Coding Conventions

### Style & Formatting

- **Prettier** with: `singleQuote: true`, `trailingComma: "all"`
- **ESLint** with `typescript-eslint` (recommended + type-checked), Prettier plugin
- `@typescript-eslint/no-explicit-any` is **off** (any is allowed)
- `@typescript-eslint/no-floating-promises` is **warn**
- Run `pnpm do` to format → lint → build → stage all changes

### TypeScript

- **Target:** ES2023
- **Module:** NodeNext (ESM-compatible resolution)
- **strictNullChecks:** enabled
- **noImplicitAny:** disabled
- **experimentalDecorators + emitDecoratorMetadata:** enabled (NestJS requirement)

### NestJS Patterns

- **One module per domain** — each feature has its own `*.module.ts` with controller, service, DTOs, entities
- **Soft deletes** — all entities extend `BaseEntity` which has `isDeleted: boolean` (default `false`). Never hard-delete documents; set `isDeleted: true` and filter with `{ isDeleted: false }` in queries
- **Global prefix** — all routes are prefixed with `/api` (set in `main.ts`)
- **ValidationPipe** — globally enabled with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **DTOs** use `class-validator` decorators for validation and `class-transformer` for transformation
- **Swagger** decorators on DTOs and controllers for API documentation (available at `/api/docs`)

### MongoDB / Mongoose Patterns

- **Schemas** use `@Schema()` and `@Prop()` decorators from `@nestjs/mongoose`
- **Timestamps** — most schemas use `@Schema({ timestamps: true })` for automatic `createdAt`/`updatedAt`
- **Lean queries** — use `.lean().exec()` for read-only queries (returns plain objects, better performance)
- **ObjectId references** — store as `MongooseSchema.Types.ObjectId`, convert with `new Types.ObjectId()`
- **Aggregation pipelines** — used extensively for joins (`$lookup`), filtering, and computed fields
- **Pipeline updates** — complex updates use aggregation pipeline syntax (`updateOne(filter, [{ $set: ... }])`) instead of simple `$set` to enable computed fields

### Authentication

- **JWT-based** — access token in `Authorization: Bearer` header
- **Refresh tokens** — stored client-side in secure storage
- **Guards** — `JwtAuthGuard` for authentication, `RolesGuard` + `@Roles()` decorator for authorisation
- **User roles:** `admin`, `manager`, `user`

### Error Handling

- Services catch errors and re-throw as NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Pattern: `if (error instanceof HttpException) throw error;` then wrap unknown errors in `InternalServerErrorException`

### Testing

- **Do NOT write unit tests or integration tests.** Do not create or modify `*.spec.ts`, `*.e2e-spec.ts`, or anything under `test/` unless explicitly asked to in that request.
- Validate changes with `pnpm do` (format + lint + build) instead.
- Existing test tooling (Jest config in `package.json`, `test/__mocks__/expo-server-sdk.ts`) is left as-is; do not extend it.

---

## Environment Variables

Key variables expected in `.env`:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `EXPO_ACCESS_TOKEN` | Expo push notification access token |
| `CLOUDINARY_*` | Cloudinary upload credentials |
| `MSG91_*` | MSG91 SMS/OTP credentials |
| `PORT` | Server port (default: 3000) |

---

## Running

```bash
pnpm install          # Install dependencies
pnpm start:dev        # Development (watch mode)
pnpm build            # Production build
pnpm start:prod       # Run production build
pnpm do               # Format + lint + build + git add (pre-commit shortcut)
```

---

## Docker

```bash
docker build -t zz-backend .
docker run -p 3000:3000 --env-file .env zz-backend
```

Uses `node:20-alpine` with `corepack enable` for pnpm support.

---

## Key Architectural Decisions

1. **Event-sourced tasks** — The task system uses append-only `TaskEvent` documents with optimistic concurrency (version field). All mutations go through `TaskEventService.appendEvent()`. The `Task` document is a read-model projected from events.

2. **Debounced notifications** — Both task activity and complaint notifications are debounced (3s for tasks, 120s for complaints) to avoid notification spam. Both are also persisted to MongoDB to survive server restarts: complaints in `PendingComplaint`, task activity in `PendingTaskActivity` (sent by the `recoverPendingActivity` cron if a restart missed it).

3. **Push token management** — Users have both a legacy `pushToken: string` field and a newer `pushTokens: UserPushToken[]` array. The `PushTokenService` manages both with backward-compat fallback. See `.agents/notification-system.md` for details.

4. **Soft deletes everywhere** — No hard deletes. All entities use `isDeleted` flag.

5. **Outlet-scoped access** — Managers can only access data for outlets they're assigned to. Admins have global access.

6. **Task visibility and audience** — `task-visibility.util.ts` holds the one rule for who sees a task: admins see every task; everyone else sees tasks they are assigned to (`assigneeIds`) or created. Delegating or reassigning a task adds the target to `assigneeIds`. The same audience (minus the actor) gets the task's unread counts (`unreadMap`) and its pushes. `GET /tasks/unread-summary` returns every Tasks badge for the app.

7. **Sending pushes** — Send pushes with `NotificationsService.sendPushToUsers(userIds, title, body, data)`, not `sendPush` with raw tokens. It resolves each user's devices and sets their app icon `badge` from the registered badge sources (`tasks` in `TaskViewService`, `reviews` in `ReviewService`, registered on module init). If a badge source fails, the push is sent without a badge.
