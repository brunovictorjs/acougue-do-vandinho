import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { LocationMessage, SendResult, WhatsAppGateway, WhatsAppSendError } from '../domain/whatsapp-gateway.js';

/**
 * Z-API adapter (https://developer.z-api.io). Ready for when the instance is
 * paid: set WHATSAPP_PROVIDER=zapi, ZAPI_INSTANCE_ID, ZAPI_TOKEN and
 * ZAPI_CLIENT_TOKEN (the account security token), and point the instance's
 * "on message received" webhook to /api/webhooks/zapi?secret=ZAPI_WEBHOOK_SECRET.
 *
 * Sends arrive here one at a time from `OutboxWorker` — never call it directly.
 */
@Injectable()
export class ZApiWhatsAppGateway extends WhatsAppGateway {
  readonly name = 'zapi' as const;
  private readonly logger = new Logger('Z-API');

  constructor(private readonly config: AppConfig) {
    super();
  }

  private async post(path: string, body: Record<string, unknown>): Promise<SendResult> {
    const { zapiBaseUrl, zapiInstanceId, zapiToken, zapiClientToken } = this.config.whatsapp;
    const url = `${zapiBaseUrl}/instances/${zapiInstanceId}/token/${zapiToken}/${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(zapiClientToken ? { 'Client-Token': zapiClientToken } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      // Network failure or timeout: the message may or may not have gone out,
      // but the queue has to assume it did not and retry later.
      throw new WhatsAppSendError(`Z-API ${path} inacessível: ${err instanceof Error ? err.message : String(err)}`, true);
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`Z-API ${path} falhou (${res.status}): ${text}`);
      // 429 means we are already being throttled, 5xx is the provider's side —
      // both deserve a retry. Any other 4xx is a bad request we must not repeat.
      const retryable = res.status === 429 || res.status >= 500;
      throw new WhatsAppSendError(`Z-API ${res.status}: ${text.slice(0, 300)}`, retryable, res.status);
    }

    const json = JSON.parse(text || '{}') as { messageId?: string; zaapId?: string };
    return { providerMessageId: json.messageId ?? json.zaapId ?? null };
  }

  sendText(phone: string, text: string) {
    return this.post('send-text', { phone, message: text });
  }

  sendLocation(phone: string, l: LocationMessage) {
    return this.post('send-location', { phone, title: l.title, address: l.address, latitude: String(l.latitude), longitude: String(l.longitude) });
  }
}
