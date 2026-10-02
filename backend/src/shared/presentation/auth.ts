import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';

export type RoleName = 'CUSTOMER' | 'COURIER' | 'EMPLOYEE' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  role: RoleName;
  firstName: string;
  phone: string | null;
  phoneVerified: boolean;
}

export interface SessionPayload {
  sub: string;
}

const PUBLIC_KEY = 'auth:public';
const ROLES_KEY = 'auth:roles';
const ONBOARDED_KEY = 'auth:onboarded';

/** Route is reachable without a session (a session is still read when present). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Restrict a route to one or more roles. ADMIN always passes. */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
/** Customer must have a verified phone and at least one address. */
export const RequireOnboarding = () => SetMetadata(ONBOARDED_KEY, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});

export const OptionalUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | null => {
  return ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user ?? null;
});

/**
 * Global guard: reads the session cookie, loads the user fresh from the
 * database (so role changes apply immediately) and enforces @Roles and
 * @RequireOnboarding.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets);
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = await this.readUser(req);
    if (user) req.user = user;

    if (isPublic) return true;
    if (!user) throw new UnauthorizedException('Faça login para continuar.');

    const roles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, targets);
    if (roles?.length && user.role !== 'ADMIN' && !roles.includes(user.role)) {
      throw new ForbiddenException('Você não tem acesso a esta área.');
    }

    const needsOnboarding = this.reflector.getAllAndOverride<boolean>(ONBOARDED_KEY, targets);
    if (needsOnboarding) {
      const addresses = await this.prisma.address.count({ where: { userId: user.id } });
      if (!user.phoneVerified || addresses === 0) {
        throw new ForbiddenException({
          message: 'Complete seu cadastro (telefone e endereço) para continuar.',
          code: 'onboarding_required',
        });
      }
    }
    return true;
  }

  private async readUser(req: Request): Promise<AuthUser | null> {
    const token = (req.cookies as Record<string, string> | undefined)?.[this.config.sessionCookie];
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<SessionPayload>(token);
      const u = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!u) return null;
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.firstName,
        phone: u.phone,
        phoneVerified: !!u.phoneVerifiedAt,
      };
    } catch {
      return null;
    }
  }
}
