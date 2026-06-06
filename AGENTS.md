# AGENTS.md — AI Agent Guide for `zz-backend`

This file provides context and rules for AI agents working in this repository.

---

## Project Overview

`zz-backend` is the NestJS (TypeScript) backend for the **ZamZam** platform — a multi-outlet bakery/cafe management system. It exposes a REST API consumed by admin dashboards and customer-facing mobile/web apps.

**Key technologies:**
| Technology | Purpose |
|---|---|
| NestJS 11 | Framework (modules, controllers, services, guards) |
| MongoDB + Mongoose | Primary database (via `@nestjs/mongoose`) |
| JWT + Passport | Authentication (access & refresh tokens, OTP login) |
| Cloudinary | Image/file upload storage |
| MSG91 | SMS OTP delivery |
| Expo Server SDK | Push notifications |
| Swagger (`@nestjs/swagger`) | Auto-generated API docs at `/api/docs` |
| pnpm | Package manager |
| Docker | Containerisation (`Dockerfile` + `docker-compose.yml`) |

---

## Repository Structure

```
zz-backend/
├── src/
│   ├── app.module.ts          # Root module — registers all feature modules
│   ├── main.ts                # Bootstrap, CORS, global pipes, Swagger
│   ├── controller/            # Feature modules (each owns its controller, service, DTOs, entities)
│   │   ├── address/
│   │   ├── analytics/
│   │   ├── auth/              # JWT + OTP authentication
│   │   ├── cake-visualiser/
│   │   ├── category/
│   │   ├── custom-cake/
│   │   ├── forms/
│   │   ├── outlet/
│   │   ├── outlet-table/
│   │   ├── outlet-type/
│   │   ├── product/
│   │   ├── question/
│   │   ├── review/
│   │   ├── task/
│   │   ├── task-category/
│   │   ├── upload/
│   │   ├── uploaded-cakes/
│   │   └── users/             # User CRUD, roles, identifiers
│   ├── common/
│   │   └── entities/
│   │       └── base.entity.ts # Shared base Mongoose entity (timestamps, etc.)
│   ├── config/
│   │   └── cloudinary.config.ts
│   ├── integrations/
│   │   └── msg91/             # MSG91 SMS OTP integration
│   ├── notifications/         # Push notifications via Expo
│   └── util/                  # Shared utilities (normalize, OTP, password, QR token)
├── scripts/                   # One-off migration scripts (ts-node)
├── test/                      # E2E test config
├── .agents/                   # ← Agent scratch space (see rule below)
├── .env                       # Environment variables (never commit secrets)
├── Dockerfile
├── docker-compose.yml
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### Module anatomy (per feature inside `src/controller/<feature>/`)

```
<feature>/
├── <feature>.controller.ts   # Route handlers, Swagger decorators
├── <feature>.service.ts      # Business logic
├── <feature>.module.ts       # NestJS module wiring
├── dto/                      # class-validator DTOs (input validation)
├── entities/                 # Mongoose schemas / documents
└── interfaces/               # TypeScript interfaces & enums
```

---

## Coding Conventions

- **Language:** TypeScript (strict mode). Never use `any` unless unavoidable.
- **Formatting:** Prettier (config in `.prettierrc`). Run `pnpm format` before committing.
- **Linting:** ESLint. Run `pnpm lint` before committing.
- **Validation:** All incoming request bodies must use `class-validator` DTOs. The global `ValidationPipe` enforces `whitelist: true` and `forbidNonWhitelisted: true`.
- **Auth guards:** Use `@UseGuards(JwtAuthGuard)` on protected routes. Role-based access is handled via decorators in `src/controller/auth/decorators/`.
- **Database:** Use Mongoose schemas defined in the feature's `entities/` folder. Extend `base.entity.ts` where appropriate.
- **Error handling:** Throw NestJS HTTP exceptions (`BadRequestException`, `UnauthorizedException`, etc.) — never raw `Error`.
- **API prefix:** All routes are prefixed with `/api` (set globally in `main.ts`).
- **Swagger:** Decorate controllers and DTOs with `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth('JWT-auth')` etc.

---

## Environment Variables

Required variables (see `.env`):

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens (1 day TTL) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (7 day TTL) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `PASSWORD_SALT_ROUNDS` | bcrypt salt rounds |
| `GEMINI_API_KEY` | Google Gemini API key |
| `MSG91_AUTH_KEY` | MSG91 authentication key |
| `MSG91_TEMPLATE_ID` | MSG91 OTP template ID |
| `HIDDEN_OUTLET_TYPE_IDS` | Comma-separated outlet type IDs to hide from reviews |

> **Never hard-code secrets.** Always read them via `ConfigService`.

---

## Common Commands

```bash
# Install dependencies
pnpm install

# Start in watch mode (development)
pnpm run start:dev

# Build
pnpm run build

# Start production build
pnpm run start:prod

# Format + lint + build + stage (all-in-one)
pnpm run do
```

---

## User Roles

Defined in `src/controller/users/interfaces/user.interface.ts`:

| Role | Description |
|---|---|
| `ADMIN` | Full access; password-based login |
| `MANAGER` | Outlet-level management; password-based login |
| `USER` | Customer; OTP-based login |

---

## Authentication Flow

1. **Admin/Manager login:** `POST /api/auth/login` → email/username + password → JWT access + refresh tokens.
2. **Customer (OTP) login:**
   - `POST /api/auth/request-otp` → phone number → sends OTP via MSG91.
   - `POST /api/auth/verify-otp` → phone number + OTP → JWT access + refresh tokens (auto-registers user if new).
3. **Token refresh:** `POST /api/auth/refresh` → sends refresh token → new token pair.

---

## Adding a New Feature Module

1. Create `src/controller/<feature>/` with the standard files above.
2. Register the module in `src/app.module.ts` imports array.
3. Add DTOs with `class-validator` decorators.
4. Add Swagger decorators to the controller.

---

## Agent Storage Policy

> **⚠️ IMPORTANT — READ BEFORE CREATING ANY FILES**
>
> Agents **must not** create new folders anywhere in this repository for storing scratch files, notes, plans, generated artifacts, temporary outputs, or any other intermediate data.
>
> **All agent-generated files must be placed inside:**
> ```
> /home/abin98anto/Desktop/zz-repos/zz-backend/.agents/
> ```
> This folder is git-ignored and is the sole designated scratch space for agent work. Organise files within it using descriptive names or sub-folders scoped to your task (e.g., `.agents/migration-plan.md`, `.agents/debug-session/`). Do **not** create folders outside `.agents/` for any purpose.
