import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config.js';
import { OptionalUser, Public } from '../../../shared/presentation/auth.js';
import type { AuthUser } from '../../../shared/presentation/auth.js';
import { ProfileService } from '../application/profile.service.js';
import { AuthService } from '../application/auth.service.js';
import { DevLoginDto } from './dto.js';

const STATE_COOKIE = 'vnd_oauth_state';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly auth: AuthService,
    private readonly profile: ProfileService,
    private readonly config: AppConfig,
  ) {}

  private cookieOptions(maxAgeMs: number): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.config.cookieSecure, path: '/', maxAge: maxAgeMs };
  }

  private setSession(res: Response, userId: string) {
    res.cookie(this.config.sessionCookie, this.auth.issueSession(userId), this.cookieOptions(this.config.sessionDays * 86_400_000));
  }

  /** Current user or null — lets the frontend check the session without a 401. */
  @Public()
  @Get('session')
  async session(@OptionalUser() user: AuthUser | null) {
    return { user: user ? await this.profile.me(user.id) : null };
  }

  @Public()
  @Get('providers')
  providers() {
    return this.auth.providers;
  }

  @Public()
  @Get('google')
  google(@Res() res: Response) {
    if (!this.auth.providers.google) {
      return res.redirect(`${this.config.frontendUrl}/entrar?erro=google_indisponivel`);
    }
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, this.cookieOptions(10 * 60_000));
    return res.redirect(this.auth.googleAuthUrl(state));
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const expected = (req.cookies as Record<string, string>)[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/' });
    if (!code || !state || state !== expected) {
      return res.redirect(`${this.config.frontendUrl}/entrar?erro=estado_invalido`);
    }
    try {
      const user = await this.auth.loginWithGoogle(code);
      this.setSession(res, user.id);
      return res.redirect(`${this.config.frontendUrl}/entrar/concluido`);
    } catch (err) {
      this.logger.error('Google login failed', err instanceof Error ? err.stack : String(err));
      return res.redirect(`${this.config.frontendUrl}/entrar?erro=falha_google`);
    }
  }

  @Public()
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Body() dto: DevLoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.devLogin(dto.role);
    this.setSession(res, user.id);
    return { ok: true, role: user.role };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.config.sessionCookie, { path: '/' });
    return { ok: true };
  }
}
