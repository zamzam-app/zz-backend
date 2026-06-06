# Role-Based Access Control (RBAC) in `zz-backend`

This document outlines the implementation and usage of Role-Based Access Control (RBAC) within the `zz-backend` NestJS application.

---

## 1. User Roles

The system currently defines three distinct roles. These are codified in the `UserRole` enum located at `src/controller/users/interfaces/user.interface.ts`:

- `ADMIN` (`'admin'`): Has full access to the system. Typically used for overall platform administration, managing global settings, categories, products, and overseeing all outlets.
- `MANAGER` (`'manager'`): Has elevated access compared to a standard user, specifically scoped to outlet-level management tasks.
- `USER` (`'user'`): The standard customer role. Represents end-users interacting with the consumer-facing applications.

---

## 2. Core Implementation

The RBAC implementation relies on a combination of custom decorators and NestJS Guards.

### A. The `@Roles` Decorator
**Location:** `src/controller/auth/decorators/roles.decorator.ts`

The `@Roles` decorator is used to define which roles are permitted to access a specific route or an entire controller. It leverages NestJS's `SetMetadata` to attach the required roles to the route handler context.

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/interfaces/user.interface';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### B. The `RolesGuard`
**Location:** `src/controller/auth/guards/roles.guard.ts`

The `RolesGuard` implements the `CanActivate` interface. It is responsible for checking if the authenticated user possesses at least one of the roles required by the route.

1. It retrieves the required roles metadata set by the `@Roles` decorator.
2. If no roles are specified, access is granted by default (assuming authentication has already passed).
3. It extracts the `user` object from the request (which is populated by the `JwtAuthGuard`).
4. It checks if the `user.role` matches any of the required roles.

---

## 3. Usage Pattern in Controllers

To enforce role-based access on an endpoint, both the `JwtAuthGuard` (to authenticate the user) and the `RolesGuard` (to authorize the user based on roles) must be applied.

Typically, this is done using the `@UseGuards` decorator alongside the `@Roles` decorator.

### Example: Method-Level Restriction
Restricting a specific endpoint (e.g., creating a product) to `ADMIN` only:

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';

// ... inside a controller
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createProduct(@Body() createDto: CreateDto) {
    // Only users with 'admin' role can execute this
  }
```

### Example: Controller-Level Restriction
You can apply the guards at the controller class level. All endpoints within the controller will then require the user to be authenticated and authorized. 

```typescript
@Controller('task')
@UseGuards(JwtAuthGuard, RolesGuard) // Applied to all routes in TaskController
export class TaskController {
    
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll() {
    // Both ADMIN and MANAGER can access this
  }
}
```

---

## 4. Current Application Examples

Based on the existing codebase, here are common patterns of access restriction:

- **Admin Only Operations:** Endpoints that handle core platform data manipulation (e.g., managing Categories, Products, Forms, Outlet Types, Questions, and User administration) are heavily restricted using `@Roles(UserRole.ADMIN)`.
- **Manager & Admin Shared Operations:** Modules related to day-to-day operations at the outlet level (e.g., the `TaskController`) are generally accessible by both roles via `@Roles(UserRole.ADMIN, UserRole.MANAGER)`.
- **General Access:** Endpoints that fetch basic outlet data or user profile data might use `@Roles(UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)` or simply rely on `JwtAuthGuard` without a `RolesGuard` if any authenticated user is allowed.
