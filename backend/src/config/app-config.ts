import { Injectable } from '@nestjs/common';

const bool = (v: string | undefined, fallback: boolean) =>
  v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

/**
 * Typed view over environment variables. Every integration has a local
 * fallback so the whole app runs on a laptop without paid services:
 * - payments: `fake` (simulated Pix/card) or `stripe`
 * - whatsapp: `log` (prints + stores messages) or `zapi`
 * - assistant: Claude when ANTHROPIC_API_KEY is set, rule-based otherwise
 */
@Injectable()
export class AppConfig {
  readonly port = Number(process.env.PORT ?? 3333);
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  readonly databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

  readonly jwtSecret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
  readonly sessionCookie = 'vnd_session';
  readonly sessionDays = Number(process.env.SESSION_DAYS ?? 7);
  readonly cookieSecure = bool(process.env.COOKIE_SECURE, false);

  readonly google = {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? `${this.frontendUrl}/api/auth/google/callback`,
  };
  readonly devLoginEnabled = bool(process.env.AUTH_DEV_LOGIN, this.nodeEnv !== 'production');
  readonly adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  readonly payments = {
    provider: (process.env.PAYMENT_PROVIDER ?? 'fake') as 'fake' | 'stripe',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  };

  readonly whatsapp = {
    provider: (process.env.WHATSAPP_PROVIDER ?? 'log') as 'log' | 'zapi',
    zapiInstanceId: process.env.ZAPI_INSTANCE_ID ?? '',
    zapiToken: process.env.ZAPI_TOKEN ?? '',
    zapiClientToken: process.env.ZAPI_CLIENT_TOKEN ?? '',
    zapiBaseUrl: process.env.ZAPI_BASE_URL ?? 'https://api.z-api.io',
    webhookSecret: process.env.ZAPI_WEBHOOK_SECRET ?? '',
  };

  /**
   * Outbound WhatsApp pacing. Messages never leave the process faster than
   * this, because a burst from a single number is what gets it limited or
   * blocked by WhatsApp. Defaults are deliberately conservative; raise them
   * only with a warmed-up, paid Z-API instance.
   */
  readonly whatsappQueue = {
    tickMs: Number(process.env.WHATSAPP_QUEUE_TICK_MS ?? 1000),
    minIntervalMs: Number(process.env.WHATSAPP_MIN_INTERVAL_MS ?? 4000),
    perPhoneIntervalMs: Number(process.env.WHATSAPP_PER_PHONE_INTERVAL_MS ?? 15000),
    perMinuteLimit: Number(process.env.WHATSAPP_PER_MINUTE_LIMIT ?? 12),
    maxAttempts: Number(process.env.WHATSAPP_MAX_ATTEMPTS ?? 5),
    backoffBaseMs: Number(process.env.WHATSAPP_BACKOFF_BASE_MS ?? 30000),
    backoffMaxMs: Number(process.env.WHATSAPP_BACKOFF_MAX_MS ?? 1800000),
  };

  readonly assistant = {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
    effort: (process.env.ANTHROPIC_EFFORT ?? 'low') as 'low' | 'medium' | 'high',
    historyLimit: Number(process.env.ASSISTANT_HISTORY_LIMIT ?? 20),
  };

  readonly uploads = {
    dir: process.env.UPLOAD_DIR ?? './uploads',
    publicPath: '/api/uploads',
    maxImageBytes: 5 * 1024 * 1024,
    maxVideoBytes: 50 * 1024 * 1024,
  };

  readonly geocoding = bool(process.env.GEOCODING_ENABLED, true);

  get isProduction() {
    return this.nodeEnv === 'production';
  }
}
