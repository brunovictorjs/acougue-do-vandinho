import { Injectable } from '@nestjs/common';
import { Events } from '../../../shared/application/integration-events.js';
import { pageArgs, paged } from '../../../shared/application/pagination.js';
import { BusinessRuleError } from '../../../shared/domain/errors.js';
import { normalizePhone } from '../../../shared/domain/text.js';
import { DomainEventPublisher } from '../../../shared/infrastructure/events/domain-event-publisher.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { WhatsAppSender } from './whatsapp-sender.service.js';

/** Incoming WhatsApp messages (Z-API webhook or the admin simulator). */
@Injectable()
export class InboundService {
  constructor(
    private readonly sender: WhatsAppSender,
    private readonly events: DomainEventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async receive(rawPhone: string, text: string, senderName?: string | null, via: 'zapi' | 'simulator' = 'zapi') {
    const phone = normalizePhone(rawPhone);
    const body = text.trim();
    if (!phone) throw new BusinessRuleError('Telefone inválido.');
    if (!body) return { ignored: true };
    await this.sender.recordInbound(phone, body, { senderName, via });
    this.events.publish({ name: Events.WhatsAppMessageReceived, phone, text: body.slice(0, 2000), senderName });
    return { ok: true, phone };
  }

  async conversations(page?: number) {
    const p = pageArgs(page);
    const [latest, total] = await Promise.all([
      this.prisma.whatsAppMessage.groupBy({ by: ['phone'], _max: { createdAt: true }, _count: { _all: true }, orderBy: { _max: { createdAt: 'desc' } }, skip: p.skip, take: p.take }),
      this.prisma.whatsAppMessage.groupBy({ by: ['phone'] }).then((g) => g.length),
    ]);
    const phones = latest.map((l) => l.phone);
    const [users, lastMessages] = await Promise.all([
      this.prisma.user.findMany({ where: { phone: { in: phones } }, select: { phone: true, firstName: true, lastName: true } }),
      Promise.all(phones.map((phone) => this.prisma.whatsAppMessage.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } }))),
    ]);
    const handoffs = await this.prisma.whatsAppMessage.findMany({ where: { phone: { in: phones }, direction: 'OUTBOUND', meta: { contains: '"handoff":true' } }, select: { phone: true } });
    const handoffSet = new Set(handoffs.map((h) => h.phone));
    const items = latest.map((l, i) => {
      const u = users.find((x) => x.phone === l.phone);
      return {
        phone: l.phone,
        customerName: u ? `${u.firstName} ${u.lastName}`.trim() : null,
        messages: l._count._all,
        lastAt: l._max.createdAt,
        lastMessage: lastMessages[i]?.body.slice(0, 140) ?? '',
        handedOff: handoffSet.has(l.phone),
      };
    });
    return paged(items, total, p);
  }

  async messages(phone: string) {
    const rows = await this.prisma.whatsAppMessage.findMany({ where: { phone }, orderBy: { createdAt: 'asc' }, take: 300 });
    return rows.map((r) => ({ ...r, meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null }));
  }

  async stats(days = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [conversations, outbound, failed, handoffs] = await Promise.all([
      this.prisma.whatsAppMessage.groupBy({ by: ['phone'], where: { direction: 'INBOUND', createdAt: { gte: since } } }),
      this.prisma.whatsAppMessage.count({ where: { direction: 'OUTBOUND', createdAt: { gte: since }, meta: { contains: '"template"' } } }),
      this.prisma.whatsAppMessage.count({ where: { direction: 'OUTBOUND', createdAt: { gte: since }, status: 'failed' } }),
      this.prisma.whatsAppMessage.count({ where: { direction: 'OUTBOUND', createdAt: { gte: since }, meta: { contains: '"handoff":true' } } }),
    ]);
    return { days, conversations: conversations.length, notifications: outbound, failed, handoffs, provider: this.sender.provider };
  }
}
