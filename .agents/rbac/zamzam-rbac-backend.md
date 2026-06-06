# RBAC — Backend Implementation Guide
> zz-backend · NestJS · v4 · Updated to reflect third repo audit

---

## Overview

The backend is responsible for **all enforcement**. The iOS UI restrictions are a convenience layer only — every role check and outlet scope must be validated server-side regardless of what the client sends.

Two mechanisms work together:
- **`RolesGuard`** — blocks requests from roles that have no access to an endpoint at all.
- **Outlet scoping** — for roles that do have access, filters query results and validates write targets against the user's `assignedOutletIds`, fetched dynamically from the User document on every request.

### Role summary

| Role | Login method | App | Notes |
|---|---|---|---|
| `admin` | Email + password | Admin iOS app | Full access |
| `zct` | Email + password | Admin iOS app | New role — must be added to password-login allowlist |
| `manager` | Email + password | Admin iOS app | Existing role |
| `user` | OTP (phone) | Customer web app | **Keep as-is.** OTP login must explicitly block all non-`user` roles from receiving tokens. Never receives internal-app permissions. |
| `supplier` | TBD | TBD | Reserved — Phase 2. All routes return `403`. |

### Role values stay lowercase

The existing DB and API use lowercase role strings (`admin`, `manager`, `user`). **Do not change casing.** Add new values in the same convention: `zct`, `supplier`. Changing existing values would require a DB + client migration — out of scope.

---

## Step 1 — Update the UserRole Enum

**File:** `src/controller/users/interfaces/user.interface.ts`

```typescript
export enum UserRole {
  ADMIN    = 'admin',
  MANAGER  = 'manager',
  USER     = 'user',       // Customer OTP login — do not touch
  ZCT      = 'zct',        // New internal role
  SUPPLIER = 'supplier',   // Reserved — Phase 2
}
```

`SUPPLIER` must never be added to any `@Roles()` decorator until Phase 2.
`USER` must never appear in any admin-app `@Roles()` list.

---

## Step 2 — Update the User Schema

**File:** `src/controller/users/entities/user.entity.ts`

Add two new fields. Do not remove or rename any existing field.

```typescript
@Prop({ type: [{ type: Types.ObjectId, ref: 'Outlet' }], default: [] })
assignedOutletIds: Types.ObjectId[];

@Prop({ type: Number, default: 0 })
tokenVersion: number;
```

**`tokenVersion` — existing users:** Existing documents won't have this field. Always read it as `user.tokenVersion ?? 0` everywhere it is used. Run a one-time seed to backfill `{ tokenVersion: 0 }` on all existing documents (see Step 10).

**`assignedOutletIds` vs legacy `outlets` field:**
The existing `UserDb` interface in `src/controller/users/interfaces/user.interface.ts` already declares an `outlets?: string[]` property. This field is superseded by `assignedOutletIds` but must not be removed yet — removing it would break any existing runtime code that reads it. Mark it `@deprecated` in the interface comment and add a note in the schema entity. All new code must reference `assignedOutletIds` only. Schedule removal of `outlets` as a separate migration task after all consumers are confirmed migrated.

```typescript
// user.interface.ts — mark the old field as deprecated
/** @deprecated Use assignedOutletIds on the User entity instead */
outlets?: string[];
```

**`assignedOutletIds` vs `Outlet.managerIds` — sync rules:**
- `assignedOutletIds` on User is the authoritative source for RBAC scoping going forward.
- `Outlet.managerIds` is still used by existing manager-lookup and notification code. It must not be removed.
- When `UsersService.assignOutlets()` sets `assignedOutletIds` for a Manager, it must **also** update `Outlet.managerIds` to stay in sync — remove the old outlet's `managerId` entry and add the new one.
- New code must read from `assignedOutletIds`. Old code still reading `Outlet.managerIds` is fine until it is individually migrated.

---

## Step 3 — Lock Down OTP Login

**File:** `src/controller/auth/auth.service.ts`

OTP login currently does not restrict by role. It must only ever issue tokens for `UserRole.USER`. Non-customer roles must never be able to receive a token through the OTP flow, even if their phone number is registered:

```typescript
// auth.service.ts — verifyOtp() or equivalent OTP completion handler
const user = await this.usersService.findOne(userId);
if (user.role !== UserRole.USER) {
  throw new UnauthorizedException('OTP login is not available for this account type');
}
return this.generateTokens(user);
```

---

## Step 4 — Allow ZCT to Log In via Password

**File:** `src/controller/auth/auth.service.ts`

The current password-login allowlist (around line 50) only permits `admin` and `manager`. Add `zct`:

```typescript
// Before:
const allowedRoles = [UserRole.ADMIN, UserRole.MANAGER];

// After:
const allowedRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.ZCT];
```

---

## Step 5 — Create the `@Roles()` and `@Public()` Decorators

**File:** `src/controller/auth/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/interfaces/user.interface';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

**File:** `src/controller/auth/decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## Step 6 — Implement RolesGuard

**File:** `src/controller/auth/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../../users/interfaces/user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() routes skip role enforcement entirely
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Fail-closed: if a developer forgets @Roles() on a non-public endpoint,
    // deny access rather than letting any authenticated user through.
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Endpoint is not configured for access');
    }

    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
```

Update `JwtAuthGuard` to respect `@Public()`:

```typescript
// jwt-auth.guard.ts
canActivate(context: ExecutionContext) {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (isPublic) return true;
  return super.canActivate(context);
}
```

Register both as global guards in `app.module.ts`. Currently there are no `APP_GUARD` providers there — adding them changes the behaviour of every route, so the public-route classification below must be done first.

```typescript
import { APP_GUARD } from '@nestjs/core';

providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

### Public-route classification

**Do not blanket-mark entire controllers as `@Public()`.** Each endpoint must be classified individually. The table below lists every currently-unguarded route and its required treatment.

> **Rule:** if you are not sure whether an endpoint should be public, default to `@Roles(ADMIN)` and loosen it deliberately — never the other way around.

**AuthController**

| Endpoint | Treatment | Reason |
|---|---|---|
| `POST /auth/login` | `@Public()` | Pre-authentication |
| `POST /auth/request-otp` | `@Public()` | Pre-authentication |
| `POST /auth/verify-otp` | `@Public()` | Pre-authentication |
| `POST /auth/refresh` | `@Public()` | Uses refresh token, not access token |

**UploadController** — do not mark any endpoint public by default. Classify each endpoint explicitly:

| Endpoint | Treatment | Reason |
|---|---|---|
| `POST /upload/signature` (or equivalent presign endpoint) | `@Roles(ADMIN, ZCT, MANAGER)` | Only internal users upload files |
| Any admin-only upload management endpoints | `@Roles(ADMIN)` | — |
| Any endpoint genuinely serving public asset URLs | `@Public()` — **only after explicit confirmation** | Must be a conscious decision, not an assumption |

**OutletTableController** — do not mark all endpoints public. Classify each endpoint individually:

| Endpoint | Treatment | Reason |
|---|---|---|
| `GET /outlet-table` / `GET /outlet-table/:id` (customer-facing reads) | `@Public()` or `@Roles(USER)` — **decide which** | Tables may be needed by the customer web app without a token |
| `POST /outlet-table` | `@Roles(ADMIN)` | Create is an admin operation |
| `PATCH /outlet-table/:id` | `@Roles(ADMIN)` | Update is an admin operation |
| `DELETE /outlet-table/:id` | `@Roles(ADMIN)` | Delete is an admin operation |

---

## Step 7 — `req.user` Shape Decision

`JwtStrategy.validate()` currently returns the raw token payload. The plan requires it to return a user object with `role`, `assignedOutletIds`, and `tokenVersion`. However, existing controllers use `req.user.sub` for the user ID. Changing to a full DB user object would break those references.

**Decision: return a normalised auth shape, not the raw DB document.** This preserves `sub` for existing code while adding the new fields:

```typescript
// src/controller/auth/interfaces/auth-user.interface.ts
export interface AuthUser {
  sub: string;          // = user._id.toString() — preserves all existing req.user.sub usage
  role: UserRole;
  assignedOutletIds: Types.ObjectId[];
  tokenVersion: number;
}
```

```typescript
// jwt.strategy.ts — validate()
async validate(payload: JwtPayload): Promise<AuthUser> {
  const user = await this.usersService.findOne(payload.sub); // findOne, not findById — see Step 8
  if (!user) throw new UnauthorizedException();
  const storedVersion = user.tokenVersion ?? 0;
  if ((payload.tokenVersion ?? 0) !== storedVersion) {
    throw new UnauthorizedException({ code: 'TOKEN_VERSION_MISMATCH', message: 'Session expired' });
  }
  return {
    sub: user._id.toString(),
    role: user.role,
    assignedOutletIds: user.assignedOutletIds,
    tokenVersion: storedVersion,
  };
}
```

`req.user` is now always an `AuthUser`. All existing code using `req.user.sub` continues to work unchanged.

---

## Step 8 — UsersService — Method Naming

The repo has `findOne(id)`, not `findById(id)`. All references in this document use `findOne`. Do not add a `findById` alias — just use the existing method name consistently.

---

## Step 9 — Token Invalidation on Role / Outlet Change

### 9.1 JWT payload at login

```typescript
// auth.service.ts — generateTokens()
const payload = {
  sub: user._id.toString(),
  role: user.role,
  tokenVersion: user.tokenVersion ?? 0,
};
```

### 9.2 Access token — already covered in Step 7 (`JwtStrategy.validate()`)

### 9.3 Refresh token — also version-check

`refreshTokens()` currently re-signs from the stale refresh payload without reloading the user. Update it:

```typescript
// auth.service.ts — refreshTokens()
async refreshTokens(refreshToken: string) {
  const payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
  const user = await this.usersService.findOne(payload.sub);
  if (!user) throw new UnauthorizedException();
  const storedVersion = user.tokenVersion ?? 0;
  if ((payload.tokenVersion ?? 0) !== storedVersion) {
    throw new UnauthorizedException({ code: 'TOKEN_VERSION_MISMATCH', message: 'Session expired' });
  }
  return this.generateTokens(user);
}
```

### 9.4 Incrementing tokenVersion

```typescript
// users.service.ts
async invalidateUserSessions(userId: string): Promise<void> {
  await this.userModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}
```

Call `invalidateUserSessions` at the end of both `updateRole()` and `assignOutlets()`.

---

## Step 10 — Harden the Logout Endpoint

**File:** `src/controller/auth/auth.controller.ts` and `auth.service.ts`

The existing `POST /auth/logout` handler only clears the refresh-token cookie and is currently marked `@Public()`. This means a stolen token can never be invalidated at logout. Fix:

1. Remove `@Public()` from the logout endpoint — it now requires a valid JWT so the server knows which user is logging out.
2. Call `invalidateUserSessions()` to increment `tokenVersion`, immediately invalidating all outstanding access and refresh tokens for that user.

```typescript
// auth.controller.ts
@Post('logout')
// No @Public() — requires authenticated user
async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
  await this.authService.logout(req.user.sub, res);
}

// auth.service.ts
async logout(userId: string, res: Response): Promise<void> {
  await this.usersService.invalidateUserSessions(userId);
  res.clearCookie('refresh_token');
}
```

Update the AuthController public-route table in Step 6: `POST /auth/logout` is **not** `@Public()`.

---

## Step 11 — Seed Scripts (one-time, non-destructive)

### 10.1 Backfill tokenVersion

Set `tokenVersion: 0` on all existing User documents that don't have it:

```typescript
// scripts/seed-token-version.ts
await userModel.updateMany(
  { tokenVersion: { $exists: false } },
  { $set: { tokenVersion: 0 } }
);
```

### 10.2 Backfill assignedOutletIds for existing Managers

Read existing `Outlet.managerIds` to populate `User.assignedOutletIds`:

```typescript
// scripts/seed-manager-outlets.ts
const outlets = await outletModel.find({ managerIds: { $exists: true, $ne: [] } });
for (const outlet of outlets) {
  await userModel.updateMany(
    { _id: { $in: outlet.managerIds }, assignedOutletIds: { $ne: outlet._id } },
    { $addToSet: { assignedOutletIds: outlet._id } }
  );
}
```

Run both scripts on dev and production before enabling role enforcement.

---

## Step 12 — Outlet Scoping Helper

**File:** `src/controller/users/users.service.ts`

```typescript
async getScopedOutletIds(userId: string): Promise<Types.ObjectId[] | null> {
  const user = await this.findOne(userId);
  if (user.role === UserRole.ADMIN) return null; // null = all outlets
  return user.assignedOutletIds;
}

async validateOutletAccess(userId: string, targetOutletId: string): Promise<void> {
  const scopedIds = await this.getScopedOutletIds(userId);
  if (scopedIds === null) return; // ADMIN — always allowed
  const allowed = scopedIds.map(id => id.toString()).includes(targetOutletId.toString());
  if (!allowed) throw new ForbiddenException('Outlet not in assigned scope');
}
```

Usage pattern in any feature service:

```typescript
async findAll(requestingUserId: string) {
  const scopedIds = await this.usersService.getScopedOutletIds(requestingUserId);
  const filter = scopedIds ? { outlet: { $in: scopedIds } } : {};
  return this.taskModel.find(filter).exec();
}
```

---

## Step 13 — Role Management Endpoints

All new endpoints require `@Roles(UserRole.ADMIN)`.

### DTOs

```typescript
// dto/update-user-role.dto.ts
export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}
```

```typescript
// dto/assign-outlets.dto.ts
export class AssignOutletsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  outletIds: string[];
}
```

### Outlet assignment validation rules (enforced in `assignOutlets()`)

| Role being assigned | Rule |
|---|---|
| `admin` | Ignore outletIds — Admin has no scope restriction |
| `zct` | One or more outlets required |
| `manager` | Exactly one outlet; reject if `outletIds.length !== 1` |
| `user` | Throw `ForbiddenException` — cannot hold internal outlets |
| `supplier` | Throw `ForbiddenException` until Phase 2 |

All provided outlet IDs must exist and not be soft-deleted. This repo uses `isDeleted: false` (not `deletedAt`):

```typescript
const count = await this.outletModel.countDocuments({
  _id: { $in: dto.outletIds },
  isDeleted: false,
});
if (count !== dto.outletIds.length) {
  throw new BadRequestException('One or more outlet IDs are invalid or deleted');
}
```

After saving `assignedOutletIds`, sync `Outlet.managerIds` if the role is `manager`:

```typescript
// Remove user from all their previous outlet's managerIds
await this.outletModel.updateMany(
  { managerIds: userId },
  { $pull: { managerIds: userId } }
);
// Add user to the new outlet's managerIds
if (user.role === UserRole.MANAGER) {
  await this.outletModel.findByIdAndUpdate(
    dto.outletIds[0],
    { $addToSet: { managerIds: userId } }
  );
}
```

### Securing existing sensitive endpoints

`GET /users` currently allows managers. `PATCH /users/:id` and `change-password/:id` allow any role to target any userId. Fix:

```typescript
// GET /users — Admin only
@Get()
@Roles(UserRole.ADMIN)
findAll() { ... }

// GET /users/:id — Admin, or self only
@Get(':id')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ZCT)
findOne(@Param('id') id: string, @Request() req) {
  if (req.user.role !== UserRole.ADMIN && req.user.sub !== id) {
    throw new ForbiddenException();
  }
  return this.usersService.findOne(id);
}

// PATCH /users/:id — self only, via UpdateUserSelfDto (no role/outlet fields)
@Patch(':id')
updateSelf(@Param('id') id: string, @Body() dto: UpdateUserSelfDto, @Request() req) {
  if (req.user.sub !== id) throw new ForbiddenException();
  return this.usersService.updateSelf(id, dto);
}

// change-password — self only
@Patch('change-password/:id')
changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto, @Request() req) {
  if (req.user.sub !== id) throw new ForbiddenException();
  return this.usersService.changePassword(id, dto);
}
```

Split `UpdateUserDto` — create `UpdateUserSelfDto` that exposes only safe fields (name, phone, etc.) without `role` or outlet fields.

### New endpoints

| Method | Route | Guard | Description |
|---|---|---|---|
| `GET` | `/users` | `ADMIN` | List all internal users |
| `GET` | `/users/:id` | `ADMIN` or self | User with role + assignedOutletIds |
| `PATCH` | `/users/:id/role` | `ADMIN` | Change role; calls `invalidateUserSessions` |
| `POST` | `/users/:id/outlets` | `ADMIN` | Assign/replace outlet list; calls `invalidateUserSessions` |

---

## Step 14 — Module Wiring

Before implementing anything that crosses module boundaries, wire the dependencies:

**UsersModule** — needs `OutletSchema` to validate outlet IDs and sync `managerIds`:

```typescript
// users.module.ts
imports: [
  MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    { name: Outlet.name, schema: OutletSchema }, // add this
  ]),
]
```

**TaskModule, FormsModule, ReviewModule, AnalyticsModule** — each needs `UsersService` for `getScopedOutletIds`. Export `UsersService` from `UsersModule` and import `UsersModule` into each of these:

```typescript
// users.module.ts
exports: [UsersService]

// task.module.ts, forms.module.ts, review.module.ts, analytics.module.ts
imports: [UsersModule, ...]
```

Avoid circular imports — if any of those modules are already imported by `UsersModule`, extract the scoping helper into a shared `RbacModule` instead and import that everywhere.

---

## Step 15 — Full Controller Audit

Controller base paths must match the repo exactly. Several controllers use plural paths — the plan previously stated all paths were singular, which was incorrect. Confirmed paths:

| Controller | `@Controller(...)` path |
|---|---|
| `TaskController` | `tasks` (plural) |
| `FormsController` | `forms` (plural) |
| `UsersController` | `users` (plural) |
| `CustomCakeController` | `custom-cakes` (plural) |
| `UploadedCakesController` | `uploaded-cakes` (plural) |
| `OutletController` | `outlet` (singular) |
| `ReviewController` | `review` (singular) |
| `QuestionController` | `questions` (plural) |
| `OutletTypeController` | `outlet-type` (singular) |

Verify any unlisted controller paths directly in the repo before adding decorators.

### Controllers previously unaudited — classify before enabling global guards

Making `JwtAuthGuard` and `RolesGuard` global affects every controller. The following were missing from earlier drafts and must be explicitly classified:

#### AddressController (`@Controller('address')`)

| Endpoint | Treatment | Reason |
|---|---|---|
| All read/write endpoints | `@Roles(ADMIN)` by default | Internal data; loosen deliberately if customer web app needs any |

#### CakeVisualiserController (`@Controller('visualise-cake')`)

| Endpoint | Treatment | Reason |
|---|---|---|
| `GET` endpoints (customer preview) | `@Public()` or `@Roles(USER)` — **decide explicitly** | Customer-facing visualiser reads |
| `POST`/`PATCH`/`DELETE` mutations | `@Roles(ADMIN)` | Mutations are admin-only |

#### CustomCakeController (`@Controller('custom-cakes')`)

| Endpoint | Treatment | Reason |
|---|---|---|
| `GET` endpoints | `@Public()` or `@Roles(USER)` — **decide explicitly** | May be customer-facing order reads |
| `POST`/`PATCH`/`DELETE` mutations | `@Roles(ADMIN)` | Admin-only |

#### OutletTypeController (`@Controller('outlet-type')`)

| Endpoint | Treatment | Reason |
|---|---|---|
| `GET` endpoints | `@Public()` or `@Roles(USER)` — **decide explicitly** | Customer web app may need outlet type listings |
| `POST`/`PATCH`/`DELETE` mutations | `@Roles(ADMIN)` | Admin-only |

#### QuestionController (`@Controller('questions')`)

| Endpoint | Treatment | Reason |
|---|---|---|
| All endpoints | `@Roles(ADMIN, ZCT)` | Questions are form-builder data; internal only |

#### TaskCategoryController (`@Controller('task-category')`)

| Endpoint | Treatment | Reason |
|---|---|---|
| `GET` endpoints | `@Roles(ADMIN, ZCT, MANAGER)` | All internal roles need category lists |
| `POST`/`PATCH`/`DELETE` mutations | `@Roles(ADMIN)` | Category management is admin-only |

#### UploadedCakesController (`@Controller('uploaded-cakes')`)

| Endpoint | Treatment | Reason |
|---|---|---|
| `GET` endpoints | `@Public()` or `@Roles(USER)` — **decide explicitly** | Likely customer-facing gallery |
| `POST`/`PATCH`/`DELETE` mutations | `@Roles(ADMIN)` | Admin-only |

#### UploadController — upload signature endpoint correction

The repo's `UploadController` exposes `@Get('signature')`, not `POST /upload/signature` as previously stated. Correct classification:

| Endpoint | Treatment |
|---|---|
| `GET /upload/signature` | `@Roles(ADMIN, ZCT, MANAGER)` |

### TaskController (`@Controller('tasks')`)

> **Note:** The repo already has `@Roles(UserRole.ADMIN, UserRole.MANAGER)` on most task endpoints. This implementation is **modifying** existing decorators, not adding them from scratch. Take care not to duplicate them.

Also note: the repo uses `@Post('view-all')`, not `@Get('view-all')`. Map the actual HTTP verb from the controller file before applying decorators.

| Endpoint | Roles | Notes |
|---|---|---|
| `POST /tasks/view-all` | `ADMIN`, `ZCT`, `MANAGER` | Outlet-scoped; verb is POST not GET |
| `GET /tasks/unread-count` | `ADMIN`, `ZCT`, `MANAGER` | Outlet-scoped |
| `GET /tasks/unread-aggregated` | `ADMIN`, `ZCT`, `MANAGER` | Outlet-scoped |
| `GET /tasks/unread-ids` | `ADMIN`, `ZCT`, `MANAGER` | Outlet-scoped |
| `GET /tasks/:id` | `ADMIN`, `ZCT`, `MANAGER` | Verify task outlet is in scope |
| `POST /tasks` (create) | `ADMIN`, `ZCT` | `validateOutletAccess` on target outlet |
| `PATCH /tasks/:id` (edit) | `ADMIN` | — |
| `DELETE /tasks/:id` | `ADMIN` | — |
| `PATCH /tasks/:id/status` | `ADMIN`, `ZCT`, `MANAGER` | Verify task outlet is in scope |
| `POST /tasks/:id/reassign` | `ADMIN`, `ZCT` | `validateOutletAccess` |
| `GET /tasks/:id/comment` | `ADMIN`, `ZCT`, `MANAGER` | Verify task outlet is in scope |
| `POST /tasks/:id/comment` | `ADMIN`, `ZCT`, `MANAGER` | Verify task outlet is in scope |
| `GET /tasks/:id/events/type-counts` | `ADMIN`, `ZCT`, `MANAGER` | Verify task outlet is in scope |
| Attachments (list, upload, delete) | `ADMIN`, `ZCT`, `MANAGER` | Verify task outlet is in scope |

> If the real controller has additional routes not listed here, apply the same rule: read-only for all three roles (outlet-scoped); create/reassign for `ADMIN` and `ZCT`; edit/delete for `ADMIN` only.

**Existing role conflict:** Current task routes allow `manager` to create/update/delete tasks. Restricting those endpoints requires changing existing `@Roles(ADMIN, MANAGER)` decorators to `@Roles(ADMIN)` or `@Roles(ADMIN, ZCT)` — not adding new decorators alongside the old ones.

**Sub-service outlet ownership check:** `TaskThreadQueryService` and `TaskAttachmentService` receive only `taskId`/`userId` and do not verify outlet access. Before scoping at the service level, add a task→outlet ownership check: load the task, read its `outlet` field, call `validateOutletAccess`. This prevents ZCT or Manager from reaching tasks in unassigned outlets via direct ID guessing.

### FormsController (`@Controller('forms')`)

The Form schema currently has only `title`, `questions`, and `version` — there is no outlet linkage on the Form document. Outlet linkage goes through `Outlet.formId`. Outlet-scoped form reads cannot be implemented until this is resolved.

**Decision required before coding:**

**Option A (recommended):** Add `outletId: Types.ObjectId` (or `outletIds`) to the Form schema. Scoping filters by forms whose `outletId` intersects the user's `assignedOutletIds`. Makes forms independently queryable.

**Option B:** Resolve scoping by fetching the user's allowed outlet IDs, then returning forms whose IDs appear in those outlets' `formId` fields. More joins, no schema change.

Document the decision here and implement accordingly. Until decided, `FormsController` endpoints get `@Roles()` only (no outlet scoping yet):

| Endpoint | Roles |
|---|---|
| `POST /forms` | `ADMIN`, `ZCT` |
| `PATCH /forms/:id` | `ADMIN`, `ZCT` |
| `DELETE /forms/:id` | `ADMIN`, `ZCT` |
| `GET /forms`, `GET /forms/:id` | `ADMIN`, `ZCT` |

### ReviewController (`@Controller('review')`)

Most endpoints currently have no guards.

| Endpoint | Roles | Notes |
|---|---|---|
| `GET /review`, `GET /review/:id` | `ADMIN`, `ZCT`, `MANAGER` | Outlet-scoped |
| `POST /review/:id/resolve` (complaint) | `ADMIN`, `ZCT`, `MANAGER` | Outlet-scoped; `resolvedBy` from `req.user.sub` |

**Complaint resolution fix:** `ResolveComplaintDto` currently requires `resolvedBy` from the request body and the service uses it directly. Remove it from the DTO and set it server-side:

```typescript
// review.controller.ts
@Post(':id/resolve')
@Roles(UserRole.ADMIN, UserRole.ZCT, UserRole.MANAGER)
resolveComplaint(@Param('id') id: string, @Body() dto: ResolveComplaintDto, @Request() req) {
  return this.reviewService.resolveComplaint(id, dto, req.user.sub);
}

// review.service.ts
async resolveComplaint(reviewId: string, dto: ResolveComplaintDto, resolvedById: string) {
  // use resolvedById, not dto.resolvedBy
}
```

Remove `resolvedBy` from `ResolveComplaintDto`.

### AnalyticsController

Analytics methods currently do not receive `req.user`. Add the request user to every endpoint and pipe `getScopedOutletIds` into aggregate pipelines:

```typescript
@Get('overview')
@Roles(UserRole.ADMIN, UserRole.ZCT, UserRole.MANAGER)
getOverview(@Request() req) {
  return this.analyticsService.getOverview(req.user.sub);
}

// analytics.service.ts
async getOverview(userId: string) {
  const scopedIds = await this.usersService.getScopedOutletIds(userId);
  const matchStage = scopedIds ? { outlet: { $in: scopedIds } } : {};
  // use matchStage in $match stage of aggregate pipeline
}
```

Apply the same pattern to every analytics endpoint.

### OutletController (`@Controller('outlet')`)

Currently exposes all outlets to `user`, `manager`, and `admin`. Apply scoping and block the `user` role:

| Endpoint | Roles | Notes |
|---|---|---|
| `GET /outlet`, `GET /outlet/:id` | `ADMIN`, `ZCT`, `MANAGER` | Outlet-scoped reads |
| `POST /outlet` | `ADMIN` | — |
| `PATCH /outlet/:id` | `ADMIN` | — |
| `DELETE /outlet/:id` | `ADMIN` | — |

### OutletTableController

Do not mark all endpoints public. Classify each endpoint individually:

| Endpoint | Treatment | Reason |
|---|---|---|
| Read endpoints (if customer-facing) | `@Public()` or `@Roles(USER)` — **decide explicitly** | May be needed by customer web app |
| `POST /outlet-table` | `@Roles(ADMIN)` | Create is admin-only |
| `PATCH /outlet-table/:id` | `@Roles(ADMIN)` | Update is admin-only |
| `DELETE /outlet-table/:id` | `@Roles(ADMIN)` | Delete is admin-only |

### StudioController / ProductController / CategoryController

Public customer catalogue reads must not be blocked. Classify explicitly:

| Endpoint | Roles | Reason |
|---|---|---|
| `GET /product`, `GET /product/:id` (catalogue reads) | `@Public()` or `@Roles(USER)` — **decide explicitly** | Customer web app reads the catalogue |
| `POST /product`, `PATCH /product/:id`, `DELETE /product/:id` | `@Roles(ADMIN)` | Mutations are admin-only |
| `GET /category`, `GET /category/:id` | `@Public()` or `@Roles(USER)` — **decide explicitly** | Same as above |
| `POST /category`, `PATCH /category/:id`, `DELETE /category/:id` | `@Roles(ADMIN)` | Mutations are admin-only |

### UsersController

| Endpoint | Roles |
|---|---|
| `GET /users` | `ADMIN` only |
| `GET /users/:id` | `ADMIN` or self |
| `PATCH /users/:id` (self-update via `UpdateUserSelfDto`) | Self only |
| `PATCH /users/:id/role` | `ADMIN` only |
| `POST /users/:id/outlets` | `ADMIN` only |
| `PATCH change-password/:id` | Self only |

---

## Step 16 — Login Response

```typescript
// auth.service.ts
return {
  accessToken,
  refreshToken,
  user: {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedOutletIds: user.assignedOutletIds,
  },
};
```

---

## Step 17 — Tests

| Test area | What to cover |
|---|---|
| `RolesGuard` | Passes when role matches; throws `ForbiddenException` when it doesn't; throws `ForbiddenException` when no `@Roles()` is set (fail-closed); passes when `@Public()` |
| Token version — access | `JwtStrategy.validate()` throws `TOKEN_VERSION_MISMATCH` when versions differ; uses `?? 0` for missing field |
| Token version — refresh | `refreshTokens()` throws `TOKEN_VERSION_MISMATCH` when versions differ |
| OTP login | `user` role receives token; `admin`, `manager`, `zct` are rejected at OTP verify |
| ZCT password login | ZCT receives token; `user` role cannot use password login |
| Public routes | `@Public()` routes bypass both guards |
| Users self-update | Non-admin cannot mutate another user's record; `role` and `outlets` fields are absent from `UpdateUserSelfDto` |
| Logout | `POST /auth/logout` requires valid JWT; calls `invalidateUserSessions`; subsequent requests with old tokens are rejected |
| Task role matrix | Manager blocked from create/reassign/edit/delete; ZCT and Manager allowed on status/comment/attachments |
| Task outlet scoping | ZCT cannot read or write tasks for unassigned outlets; Manager cannot read tasks outside their outlet |
| Task sub-service outlet check | Accessing thread or attachment by taskId for an out-of-scope outlet is rejected |
| Outlet scoping — review | ZCT and Manager only receive reviews for scoped outlets |
| Outlet scoping — analytics | Aggregate pipelines return only scoped-outlet data for ZCT and Manager |
| Outlet scoping — outlet | `GET /outlet` returns only scoped outlets for ZCT and Manager |
| Outlet assignment — validation | Manager rejected with >1 outlet; `user` and `supplier` roles rejected entirely; non-existent outlet IDs rejected; soft-deleted outlet IDs rejected (`isDeleted: false`) |
| `assignedOutletIds` + `managerIds` sync | Assigning a manager to a new outlet updates `Outlet.managerIds`; old outlet entry is removed |
| Complaint resolution | `resolvedBy` is always `req.user.sub`, not the DTO value |
| `tokenVersion` backfill | Existing users without `tokenVersion` treated as version `0` |

---

## Checklist

- [ ] `UserRole` enum updated — `zct` and `supplier` added, existing values unchanged (lowercase)
- [ ] `USER` role preserved — never in any admin-app `@Roles()` list
- [ ] `assignedOutletIds` and `tokenVersion` added to User schema
- [ ] `tokenVersion ?? 0` used everywhere the field is read
- [ ] Legacy `outlets?: string[]` field in `UserDb` interface marked `@deprecated`; no new code reads it
- [ ] OTP verify blocks non-`user` roles from receiving tokens
- [ ] ZCT added to password-login allowlist
- [ ] `@Roles()` and `@Public()` decorators created
- [ ] `RolesGuard` fails **closed** — throws `ForbiddenException` when no `@Roles()` decorator is present on a non-public endpoint
- [ ] Public-route audit done — each endpoint classified individually, no controller blanket-marked
- [ ] Upload and OutletTable mutations explicitly marked `@Roles(ADMIN)`
- [ ] `GET /upload/signature` confirmed as `@Get` (not `@Post`); classified `@Roles(ADMIN, ZCT, MANAGER)`
- [ ] Studio/Product/Category read vs. mutation classification decided and applied
- [ ] Previously unaudited controllers classified: Address, CakeVisualiser, CustomCake, OutletType, Question, TaskCategory, UploadedCakes
- [ ] `JwtAuthGuard` respects `@Public()`
- [ ] Both guards registered as global providers in `app.module.ts`
- [ ] `AuthUser` interface created; `JwtStrategy.validate()` returns it; `req.user.sub` preserved
- [ ] `tokenVersion` in JWT payload at login
- [ ] `refreshTokens()` reloads user and checks `tokenVersion`
- [ ] `invalidateUserSessions()` called in `updateRole()` and `assignOutlets()`
- [ ] `POST /auth/logout` protected (not `@Public()`); calls `invalidateUserSessions()`
- [ ] Seed: `tokenVersion: 0` backfilled on all existing users
- [ ] Seed: `assignedOutletIds` backfilled from `Outlet.managerIds` for existing managers
- [ ] `getScopedOutletIds()` and `validateOutletAccess()` implemented using `findOne` (not `findById`)
- [ ] `UsersModule` imports `OutletSchema`
- [ ] `UsersService` exported from `UsersModule`; imported into Task, Forms, Review, Analytics modules
- [ ] Outlet assignment validation rules enforced (Manager = 1, ZCT = 1+, USER/SUPPLIER blocked, IDs validated with `isDeleted: false`)
- [ ] `assignOutlets()` syncs `Outlet.managerIds` for manager role
- [ ] `GET /users` restricted to Admin only
- [ ] `PATCH /users/:id` self-only; `UpdateUserSelfDto` created without role/outlet fields
- [ ] `change-password/:id` self-only check added
- [ ] TaskController path confirmed as `tasks` (plural); `view-all` confirmed as `@Post` not `@Get`
- [ ] TaskController — existing `@Roles(ADMIN, MANAGER)` decorators **replaced** (not duplicated) with correct role sets
- [ ] TaskController — all real routes audited and role-gated (view-all, unread-count, unread-aggregated, unread-ids, :id/comment, :id/events/type-counts, :id/reassign)
- [ ] Task sub-services — outlet-ownership check added before thread/attachment access
- [ ] Existing manager create/edit/delete task permissions blocked via `@Roles()`
- [ ] FormsController path confirmed as `forms` (plural); `@Roles()` applied
- [ ] FormsController — outlet linkage decision made and documented
- [ ] ReviewController — `@Roles()` and outlet scoping applied; `resolvedBy` removed from DTO; controller path is `review` (singular)
- [ ] AnalyticsController — `req.user.sub` passed to all methods; scoped filter applied to all pipelines
- [ ] OutletController — `user` role blocked; scoped reads for ZCT/Manager; controller path is `outlet` (singular)
- [ ] OutletTableController — every endpoint explicitly classified (not blanket public); mutations are `@Roles(ADMIN)`
- [ ] Login response includes `role` + `assignedOutletIds`
- [ ] All tests from Step 17 written and passing
- [ ] `pnpm run do` passes (format + lint + build)