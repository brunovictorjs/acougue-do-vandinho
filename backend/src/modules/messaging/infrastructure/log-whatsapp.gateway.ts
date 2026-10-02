import { Injectable, Logger } from '@nestjs/common';
import { formatPhone } from '../../../shared/domain/text.js';
import { LocationMessage, SendResult, WhatsAppGateway } from '../domain/whatsapp-gateway.js';

/** Test-mode gateway: every message that would go to WhatsApp is printed here. */
@Injectable()
export class LogWhatsAppGateway extends WhatsAppGateway {
  readonly name = 'log' as const;
  private readonly logger = new Logger('WhatsApp');

  private print(phone: string, body: string) {
    const line = '─'.repeat(60);
    this.logger.log(`\n┌${line}\n│ Para: ${formatPhone(phone)} (${phone})\n├${line}\n${body.split('\n').map((l) => `│ ${l}`).join('\n')}\n└${line}`);
  }

  async sendText(phone: string, text: string): Promise<SendResult> {
    this.print(phone, text);
    return { providerMessageId: null };
  }

  async sendLocation(phone: string, location: LocationMessage): Promise<SendResult> {
    this.print(phone, `[LOCALIZAÇÃO] ${location.title}\n${location.address}\nhttps://maps.google.com/?q=${location.latitude},${location.longitude}`);
    return { providerMessageId: null };
  }
}
