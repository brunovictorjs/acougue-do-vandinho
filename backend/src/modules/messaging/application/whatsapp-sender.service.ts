import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { LocationMessage, WhatsAppGateway } from '../domain/whatsapp-gateway.js';
import { WhatsAppOutboxStore } from './outbox.service.js';

/** Messages a person is waiting on in real time jump ahead of order updates. */
export const Priority = { normal: 0, interactive: 10 } as const;

export interface SendOptions {
  /** Dropped if the same key was already queued — see WhatsAppOutboxStore.enqueue. */
  idempotencyKey?: string;
  priority?: number;
}

/**
 * Queues outbound messages and keeps the transcript (used by the assistant and
 * the admin panel). Nothing here touches WhatsApp: `OutboxWorker` drains the
 * queue at a safe pace, because a burst from one number is what gets it
 * rate-limited or blocked.
 */
@Injectable()
export class WhatsAppSender {
  constructor(
    private readonly gateway: WhatsAppGateway,
    private readonly outbox: WhatsAppOutboxStore,
    private readonly prisma: PrismaService,
  ) {}

  get provider() {
    return this.gateway.name;
  }

  /** Returns the queue entry id, or null when it was a duplicate. */
  async text(phone: string, body: string, meta?: Record<string, unknown>, options?: SendOptions) {
    return this.outbox.enqueue({
      phone,
      kind: 'text',
      body,
      meta,
      idempotencyKey: options?.idempotencyKey,
      priority: options?.priority ?? Priority.normal,
    });
  }

  async location(phone: string, location: LocationMessage, meta?: Record<string, unknown>, options?: SendOptions) {
    return this.outbox.enqueue({
      phone,
      kind: 'location',
      body: `${location.title}\n${location.address}`,
      payload: { ...location },
      meta: { ...meta, latitude: location.latitude, longitude: location.longitude },
      idempotencyKey: options?.idempotencyKey,
      priority: options?.priority ?? Priority.normal,
    });
  }

  async recordInbound(phone: string, body: string, meta?: Record<string, unknown>) {
    await this.prisma.whatsAppMessage.create({
      data: { phone, direction: 'INBOUND', kind: 'text', body, meta: meta ? JSON.stringify(meta) : null, provider: this.gateway.name, status: 'received' },
    });
  }

  /** Last messages exchanged with a phone, oldest first. */
  async history(phone: string, limit: number) {
    const rows = await this.prisma.whatsAppMessage.findMany({ where: { phone }, orderBy: { createdAt: 'desc' }, take: limit });
    return rows.reverse();
  }
}
