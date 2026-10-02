import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../../../config/app-config.js';
import { ForbiddenError } from '../../../shared/domain/errors.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type { RoleName, SessionPayload } from '../../../shared/presentation/auth.js';
import { GoogleOAuthClient, GoogleProfile } from '../infrastructure/google-oauth.client.js';

const DEV_USERS: Record<RoleName, { email: string; firstName: string; lastName: string }> = {
  CUSTOMER: { email: 'cliente@vandinho.dev', firstName: 'Mariana', lastName: 'Souza' },
  COURIER: { email: 'entregador@vandinho.dev', firstName: 'Carlos', lastName: 'Silva' },
  EMPLOYEE: { email: 'funcionario@vandinho.dev', firstName: 'Joana', lastName: 'Lima' },
  ADMIN: { email: 'admin@vandinho.dev', firstName: 'Vandinho', lastName: '' },
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly google: GoogleOAuthClient,
    private readonly config: AppConfig,
  ) {}

  get providers() {
    return { google: this.google.enabled, dev: this.config.devLoginEnabled };
  }

  googleAuthUrl(state: string) {
    return this.google.authUrl(state);
  }

  async loginWithGoogle(code: string) {
    const profile = await this.google.exchange(code);
    return this.upsertGoogleUser(profile);
  }

  /** Emails listed in ADMIN_EMAILS become admins on login; roles are otherwise managed in the admin panel. */
  private async upsertGoogleUser(p: GoogleProfile) {
    const isAdmin = this.config.adminEmails.includes(p.email);
    const existing =
      (await this.prisma.user.findUnique({ where: { googleId: p.googleId } })) ??
      (await this.prisma.user.findUnique({ where: { email: p.email } }));
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: p.googleId,
          avatarUrl: existing.avatarUrl ?? p.avatarUrl,
          ...(isAdmin ? { role: 'ADMIN' } : {}),
        },
      });
    }
    return this.prisma.user.create({
      data: {
        email: p.email,
        googleId: p.googleId,
        firstName: p.firstName,
        lastName: p.lastName,
        avatarUrl: p.avatarUrl,
        role: isAdmin ? 'ADMIN' : 'CUSTOMER',
      },
    });
  }

  /** Local-only shortcut that signs in as a seeded user of the requested role. */
  async devLogin(role: RoleName) {
    if (!this.config.devLoginEnabled) throw new ForbiddenError('Login de desenvolvimento desativado.');
    const d = DEV_USERS[role];
    return this.prisma.user.upsert({
      where: { email: d.email },
      create: { ...d, role },
      update: {},
    });
  }

  issueSession(userId: string): string {
    const payload: SessionPayload = { sub: userId };
    return this.jwt.sign(payload, { expiresIn: `${this.config.sessionDays}d` });
  }
}
