# RBAC Feature Spec — Zamzam Admin App
> v3 · Prepared 5 June 2026 · Incorporates all client clarifications

---

## 1. Overview

Role-Based Access Control (RBAC) introduces a fixed, flat role hierarchy to the Zamzam Admin App. Every internal user holds exactly one role. The iOS app gates navigation and actions based on the active role; the NestJS backend enforces outlet scoping and permission checks on every request regardless of the UI state.

Supplier role is **deferred to Phase 2**. The `SUPPLIER` enum key will be reserved in the schema from day one; all Supplier routes return `403` until scope is defined.

---

## 2. Role Definitions

| Role | Internal Key | Outlet Access | Status |
|---|---|---|---|
| Admin | `ADMIN` | All outlets | ✅ Confirmed |
| ZCT | `ZCT` | Assigned outlets (multiple) | ✅ Confirmed |
| Manager | `MANAGER` | Own outlet only (single) | ✅ Confirmed |
| Supplier | `SUPPLIER` | TBD | 🔒 Phase 2 |

Roles are **flat** — there is no inheritance. Each role has a fixed, distinct permission set.

---

## 3. Permission Matrix

| Feature / Permission | Admin | ZCT | Manager |
|---|---|---|---|
| View outlet data | All outlets | Assigned outlets only | Own outlet only |
| View reviews & analytics | ✅ | ✅ (assigned outlets only) | ✅ (own outlet only) |
| Create forms | ✅ | ✅ | ❌ |
| Edit / delete forms | ✅ | ✅ | ❌ |
| Create tasks & checklists | ✅ | ✅ (assigned outlets only) | ❌ |
| Respond to tasks / update status / upload attachments | ✅ | ✅ | ✅ |
| Edit / delete tasks | ✅ | ❌ | ❌ |
| View & respond to complaint reviews | ✅ | ✅ | ✅ |
| Create/edit/delete records (general) | ✅ | ❌ | ❌ |
| Manage users & assign roles | ✅ | ❌ | ❌ |
| Studio / product catalogue | ✅ | ❌ | ❌ |
| Multi-outlet access | ✅ (all) | ✅ (assigned) | ❌ |



---

## 4. Backend Implementation

### 4.1 Data Model Changes

**File:** `src/controller/users/entities/user.entity.ts`

Add two fields to the existing User schema:

```typescript
import { UserRole } from '../interfaces/user.interface';

@Prop({ type: String, enum: UserRole, required: true })
role: UserRole;

@Prop({ type: [{ type: Types.ObjectId, ref: 'Outlet' }], default: [] })
assignedOutletIds: Types.ObjectId[];
```

**File:** `src/controller/users/interfaces/user.interface.ts`

Extend the existing `UserRole` enum:

```typescript
export enum UserRole {
  ADMIN    = 'ADMIN',
  ZCT      = 'ZCT',
  MANAGER  = 'MANAGER',
  SUPPLIER = 'SUPPLIER', // Reserved — Phase 2
}
```

### 4.2 RolesGuard & Decorator

**File:** `src/controller/auth/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/interfaces/user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

**File:** `src/controller/auth/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/interfaces/user.interface';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
```

Wire `RolesGuard` into `JwtAuthGuard` in `app.module.ts` as a global guard, or apply per-controller. `JwtAuthGuard` must run first.

### 4.3 Outlet Scoping Middleware

Outlet scoping is enforced **server-side on every request** — the iOS UI restrictions are a convenience layer only.

- **ADMIN**: No filtering; query all outlets.
- **ZCT**: All queries filtered to `assignedOutletIds` from the User document. Validated on create/assign operations — ZCT cannot target outlets outside their assigned list.
- **MANAGER**: All queries filtered to the single outlet in `assignedOutletIds[0]`.

Outlet is fetched **dynamically from the User document on each request** (not from the JWT payload). This ensures outlet reassignment takes effect immediately without requiring re-login or token invalidation.

```typescript
// Example: outlet-scoping helper used in service layer
async getScopedOutletFilter(userId: string): Promise<FilterQuery<Outlet>> {
  const user = await this.usersService.findById(userId);
  if (user.role === UserRole.ADMIN) return {};
  return { _id: { $in: user.assignedOutletIds } };
}
```

### 4.4 Role Management Endpoints

All endpoints protected by `@Roles(UserRole.ADMIN)`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/users` | List all users (Admin only) — user management screen |
| `GET` | `/users/:id` | Get user with role + assignedOutletIds |
| `PATCH` | `/users/:id/role` | Change a user's role |
| `POST` | `/users/:id/outlets` | Assign/update outlet list for a ZCT or Manager |

```typescript
// dto/update-user-role.dto.ts
export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

// dto/assign-outlets.dto.ts
export class AssignOutletsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  outletIds: string[];
}
```

**Role change behaviour:** Changes take effect **immediately** via the dynamic per-request outlet lookup. The backend must also **force a re-login** by invalidating existing tokens on role change (see Section 4.5).

### 4.5 Token Invalidation on Role Change

When a user's role or outlet assignment is changed, the backend must force a re-login:

```typescript
// In UsersService.updateRole() and UsersService.assignOutlets():
// Increment a tokenVersion field on the User document.
// JwtAuthGuard validates that JWT's tokenVersion matches the current value.
```

Add `tokenVersion: number` (default `0`) to the User schema. Increment on every role/outlet change. Include `tokenVersion` in the JWT payload at login. `JwtAuthGuard` rejects tokens where `payload.tokenVersion !== user.tokenVersion`.

### 4.6 Controller Audit Checklist

Apply `@Roles()` to every endpoint. Reference guide:

| Controller | Admin | ZCT | Manager |
|---|---|---|---|
| `TasksController` — create | ✅ | ✅ | ❌ |
| `TasksController` — respond/status/attachments | ✅ | ✅ | ✅ |
| `TasksController` — delete | ✅ | ❌ | ❌ |
| `FormsController` — create/edit/delete | ✅ | ✅ | ❌ |
| `ReviewsController` — view | ✅ | ✅ | ✅ |
| `ReviewsController` — respond (complaints) | ✅ | ✅ | ✅ |
| `AnalyticsController` — view | ✅ | ✅ | ✅ |
| `UsersController` — all | ✅ | ❌ | ❌ |
| `StudioController` — all | ✅ | ❌ | ❌ |


---

## 5. iOS Implementation

### 5.1 Auth Store

**File:** `src/store/authStore.ts`

Extend the Zustand auth store:

```typescript
interface AuthState {
  user: {
    id: string;
    name: string;
    role: 'ADMIN' | 'ZCT' | 'MANAGER' | 'SUPPLIER';
    assignedOutletIds: string[];
  } | null;
  // ...existing fields
}
```

Persist `role` and `assignedOutletIds` in `expo-secure-store` alongside the token. Both fields are populated from the `/api/auth/login` response.

### 5.2 Permissions Hook

**File:** `src/hooks/usePermissions.ts`

```typescript
import { useAuthStore } from '../store/authStore';

export function usePermissions() {
  const role = useAuthStore((s) => s.user?.role);
  const assignedOutletIds = useAuthStore((s) => s.user?.assignedOutletIds ?? []);

  return {
    isAdmin:            role === 'ADMIN',
    isZCT:              role === 'ZCT',
    isManager:          role === 'MANAGER',

    can: {
      createTasks:      role === 'ADMIN' || role === 'ZCT',
      respondToTasks:   true, // all roles
      editDeleteTasks:  role === 'ADMIN',

      createForms:      role === 'ADMIN' || role === 'ZCT',
      editDeleteForms:  role === 'ADMIN' || role === 'ZCT',

      viewReviews:      true, // all roles (scoped server-side)
      respondComplaints:true, // all roles

      viewAnalytics:    true, // all roles (scoped server-side)

      manageUsers:      role === 'ADMIN',
      accessStudio:     role === 'ADMIN',
      viewAllOutlets:   role === 'ADMIN',
    },

    assignedOutletIds,
  };
}
```

### 5.3 Navigation Gating

**File:** `src/navigation/AppNavigator.tsx`

| Tab | Admin | ZCT | Manager |
|---|---|---|---|
| Overview / Analytics | ✅ | ✅ | ✅ |
| Tasks | ✅ | ✅ | ✅ (read + respond only) |
| Forms | ✅ | ✅ | ❌ |
| Reviews | ✅ | ✅ | ✅ |
| User Management | ✅ | ❌ | ❌ |
| Studio | ✅ | ❌ | ❌ |
| More / Settings | ✅ | ✅ | ✅ |

```typescript
// AppNavigator.tsx — example tab gating
const { can, isAdmin } = usePermissions();

// Only render tab if permitted:
{can.createForms && <Tab.Screen name="Forms" component={FormsNavigator} />}
{can.manageUsers && <Tab.Screen name="Users" component={UsersNavigator} />}
{isAdmin         && <Tab.Screen name="Studio" component={StudioNavigator} />}
```

### 5.4 Inline Screen Guards

Apply throughout screens using `usePermissions()`:

```typescript
// TasksScreen — hide create FAB for Manager
const { can } = usePermissions();
{can.createTasks && <FAB onPress={openCreateTask} />}

// TaskDetailScreen — show respond/submit controls for all roles
// but hide edit/delete for non-Admin
{can.editDeleteTasks && <DeleteTaskButton />}

// Outlet picker (ZCT) — restrict to assigned outlets
const { assignedOutletIds } = usePermissions();
const filteredOutlets = outlets.filter(o => assignedOutletIds.includes(o.id));
```

### 5.5 Re-login on Role Change

When the backend returns `401 Unauthorized` with a `TOKEN_VERSION_MISMATCH` error code (triggered by a role or outlet change), the Axios client interceptor must:

1. Clear auth state from `expo-secure-store`.
2. Reset the Zustand auth store.
3. Navigate to `LoginScreen`.

```typescript
// src/api/client.ts — response interceptor
if (error.response?.status === 401 &&
    error.response?.data?.code === 'TOKEN_VERSION_MISMATCH') {
  await clearAuthStorage();
  useAuthStore.getState().logout();
  // Navigate to login via RootNavigator reset
}
```

### 5.6 User Management Screen (Admin only)

**Route:** `More → Manage Users` (visible only when `can.manageUsers === true`)

Displays a list of all internal users with their role and assigned outlets. Supports:
- Changing a user's role (`PATCH /users/:id/role`)
- Assigning outlets to ZCT/Manager (`POST /users/:id/outlets`)

This is an Admin-only screen. It is hidden from all other roles via navigation gating.

---

## 6. Development Assumptions

- Single role per user — no multi-role support in v1.
- Role stored as an enum on the User document. Outlet scope stored as `assignedOutletIds: ObjectId[]`.
- ZCT task/form operations are scoped to assigned outlets — backend validates on every write.
- Manager task response / status update / attachment upload is permitted (not treated as create).
- API enforces outlet scoping on every request — not UI-only.
- `SUPPLIER` enum key reserved; all Supplier routes return `403` until Phase 2.
- Role/outlet changes take effect immediately via dynamic per-request lookup + token version bump → forces re-login.

---

## 7. Out of Scope (this phase)

- Supplier role implementation — Phase 2
- Super Admin impersonation / "view as" mode
- Multi-role per user
- Fine-grained resource-level permissions (CASL)
- Android support — iOS only

---

## 8. Implementation Timeline

| Phase | Week | Layer | Key Tasks | Deliverable |
|---|---|---|---|---|
| 1 | 1 | Backend | Finalise `UserRole` enum. Update User schema (`role` + `assignedOutletIds` + `tokenVersion`). | Updated User model on dev DB |
| 1 | 1 | Backend | Implement `RolesGuard` + `@Roles()` decorator. Wire into `JwtAuthGuard`. Unit-test all role combos. | `RolesGuard` passing tests |
| 2 | 2 | Backend | Audit all controllers — attach `@Roles()` to every endpoint. Add outlet-scoping logic per service. Block create/delete for Manager. | All routes role-gated; scoping enforced |
| 2 | 2 | Backend | Expose role management endpoints (`GET`, `PATCH /role`, `POST /outlets`). Protect with `@Roles(ADMIN)`. Implement token version invalidation. | Role & outlet assignment endpoints live |
| 3 | 3 | iOS | Extend `authStore` with `role` + `assignedOutletIds`. Build `usePermissions()` hook. Persist in `expo-secure-store`. | `usePermissions` hook, updated `authStore` |
| 3 | 3 | iOS | Gate `AppNavigator` tabs by role. Add re-login interceptor for `TOKEN_VERSION_MISMATCH`. Build User Management screen (Admin only). | Navigation fully role-gated |
| 4 | 4 | iOS | Inline permission checks across all screens (create FABs, delete buttons, outlet pickers). Role badge on Settings. | All UI elements role-aware |
| 4 | 4 | iOS | End-to-end TestFlight build. Test all 3 active roles across every screen. Verify data scoping. | TestFlight preview build |
| 5 | 5 | Both | Bug fixes from TestFlight feedback. Staged rollout — enable role enforcement in production. | Production release |

> ⚠️ Timeline assumes no Supplier implementation in this phase. Adding Supplier requires ~1 additional week once scope is defined.