import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { LocationMessage, WhatsAppGateway } from '../domain/whatsapp-gateway.js';

/** Sends through the configured gateway and keeps a transcript (used by the assistant and the admin). */
@Injectable()
export class WhatsAppSender {
  private readonly logger = new Logger('WhatsAppSender');

  constructor(
    private readonly gateway: WhatsAppGateway,
    private readonly prisma: PrismaService,
  ) {}

  get provider() {
    return this.gateway.name;
  }

  async text(phone: string, body: string, meta?: Record<string, unknown>) {
    try {
      await this.gateway.sendText(phone, body);
      await this.record(phone, 'text', body, meta, 'sent');
    } catch (err) {
      this.logger.error(`Falha ao enviar para ${phone}`, err instanceof Error ? err.stack : String(err));
      await this.record(phone, 'text', body, meta, 'failed', err instanceof Error ? err.message : String(err));
    }
  }

  async location(phone: string, location: LocationMessage, meta?: Record<string, unknown>) {
    const body = `${location.title}\n${location.address}`;
    const m = { ...meta, latitude: location.latitude, longitude: location.longitude };
    try {
      await this.gateway.sendLocation(phone, location);
      await this.record(phone, 'location', body, m, 'sent');
    } catch (err) {
      await this.record(phone, 'location', body, m, 'failed', err instanceof Error ? err.message : String(err));
    }
  }

  async recordInbound(phone: string, body: string, meta?: Record<string, unknown>) {
    await this.prisma.whatsAppMessage.create({
      data: { phone, direction: 'INBOUND', kind: 'text', body, meta: meta ? JSON.stringify(meta) : null, provider: this.gateway.name, status: 'received' },
    });
  }

  private async record(phone: string, kind: string, body: string, meta: Record<string, unknown> | undefined, status: string, error?: string) {
    await this.prisma.whatsAppMessage.create({
      data: { phone, direction: 'OUTBOUND', kind, body, meta: meta ? JSON.stringify(meta) : null, provider: this.gateway.name, status, error },
    });
  }

  /** Last messages exchanged with a phone, oldest first. */
  async history(phone: string, limit: number) {
    const rows = await this.prisma.whatsAppMessage.findMany({ where: { phone }, orderBy: { createdAt: 'desc' }, take: limit });
    return rows.reverse();
  }
}
