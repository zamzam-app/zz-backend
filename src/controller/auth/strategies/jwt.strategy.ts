import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/auth.interfaces';
import { UsersService } from '../../users/users.service';

/** How long a user's status is cached, to avoid a DB read on every request. */
const AUTH_STATE_CACHE_MS = 30_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly cache = new Map<
    string,
    {
      state: Awaited<ReturnType<UsersService['getAuthState']>>;
      expiresAt: number;
    }
  >();

  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_ACCESS_SECRET is not defined in environment variables',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Do not trust the token alone: a deleted, deactivated or demoted user must
    // lose access within the cache window, not when the token expires.
    const now = Date.now();
    let entry = this.cache.get(payload.sub);
    if (!entry || entry.expiresAt <= now) {
      entry = {
        state: await this.usersService.getAuthState(payload.sub),
        expiresAt: now + AUTH_STATE_CACHE_MS,
      };
      this.cache.set(payload.sub, entry);
      if (this.cache.size > 5000) {
        for (const [key, value] of this.cache) {
          if (value.expiresAt <= now) this.cache.delete(key);
        }
      }
    }
    const state = entry.state;
    if (!state || state.isDeleted === true || state.isActive === false) {
      throw new UnauthorizedException();
    }
    return { ...payload, role: state.role, name: state.name ?? payload.name };
  }
}
