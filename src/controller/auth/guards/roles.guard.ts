import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/auth.interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    const user = req.user;

    // Check if the user's role matches any of the required roles
    // Explicit comparison with UserRole enum to satisfy lint
    return requiredRoles.some((role) => user?.role === role);
  }
}
