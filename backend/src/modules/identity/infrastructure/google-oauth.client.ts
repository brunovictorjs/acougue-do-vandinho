import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AppConfig } from '../../../config/app-config.js';
import { BusinessRuleError } from '../../../shared/domain/errors.js';

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/** Authorization-code flow against Google; the ID token is verified before use. */
@Injectable()
export class GoogleOAuthClient {
  constructor(private readonly config: AppConfig) {}

  get enabled() {
    return !!(this.config.google.clientId && this.config.google.clientSecret);
  }

  private client() {
    const { clientId, clientSecret, redirectUri } = this.config.google;
    return new OAuth2Client({ clientId, clientSecret, redirectUri });
  }

  authUrl(state: string): string {
    return this.client().generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  async exchange(code: string): Promise<GoogleProfile> {
    const client = this.client();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new BusinessRuleError('Google não retornou a identidade do usuário.');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.google.clientId });
    const p = ticket.getPayload();
    if (!p?.email || !p.email_verified) throw new BusinessRuleError('E-mail do Google não verificado.');
    return {
      googleId: p.sub,
      email: p.email.toLowerCase(),
      firstName: p.given_name ?? p.name ?? p.email.split('@')[0],
      lastName: p.family_name ?? '',
      avatarUrl: p.picture ?? null,
    };
  }
}
