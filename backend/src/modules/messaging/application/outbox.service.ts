import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { onFailure, phoneReady } from '../domain/outbox-policy.js';
import { WhatsAppSendError } from '../domain/whatsapp-gateway.js';

export interface EnqueueInput {
  phone: string;
  kind: 'text' | 'location';
  /** What goes in the transcript (for a location, title + address). */
  body: string;
  /** Gateway arguments that do not fit in `body` — a location's coordinates. */
  payload?: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
  /**
   * Stable key for the business fact behind this message, e.g. `paid:<orderId>`.
   * A second enqueue with the same key is dropped, which is what makes a
   * redelivered webhook harmless.
   */
  idempotencyKey?: string | null;
  /** Higher drains first. Use for messages a human is actively waiting on. */
  priority?: number;
}

export interface OutboxEntry {
  id: string;
  phone: string;
  kind: string;
  body: string;
  payload: string | null;
  meta: string | null;
  attempts: number;
  messageId: string | null;
}

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === 'P2002';

/**
 * The outbound queue itself: append, claim, settle. Persisted in SQLite so a
 * restart mid-drain does not lose or duplicate a customer's message.
 */
@Injectable()
export class WhatsAppOutboxStore {
  private readonly logger = new Logger('WhatsAppOutbox');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Appends a message and its `queued` transcript row. Returns the entry id,
   * or null when `idempotencyKey` was already queued or sent.
   */
  async enqueue(input: EnqueueInput): Promise<string | null> {
    const meta = input.meta ? JSON.stringify(input.meta) : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const message = await tx.whatsAppMessage.create({
          data: {
            phone: input.phone,
            direction: 'OUTBOUND',
            kind: input.kind,
            body: input.body,
            meta,
            provider: this.config.whatsapp.provider,
            status: 'queued',
          },
        });
        const entry = await tx.whatsAppOutbox.create({
          data: {
            phone: input.phone,
            kind: input.kind,
            body: input.body,
            payload: input.payload ? JSON.stringify(input.payload) : null,
            meta,
            idempotencyKey: input.idempotencyKey ?? null,
            priority: input.priority ?? 0,
            messageId: message.id,
          },
        });
        return entry.id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        this.logger.log(`Mensagem ignorada, já enfileirada: ${input.idempotencyKey}`);
        return null;
      }
      throw err;
    }
  }

  /** How many sends completed in the trailing minute. */
  countSentLastMinute(now: number) {
    return this.prisma.whatsAppOutbox.count({ where: { sentAt: { gte: new Date(now - 60_000) } } });
  }

  async lastSentAt(): Promise<number | null> {
    const row = await this.prisma.whatsAppOutbox.findFirst({
      where: { sentAt: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    return row?.sentAt?.getTime() ?? null;
  }

  private async lastSentToPhone(phone: string): Promise<number | null> {
    const row = await this.prisma.whatsAppOutbox.findFirst({
      where: { phone, sentAt: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    return row?.sentAt?.getTime() ?? null;
  }

  /**
   * Next due entry whose number is also past its own cooldown. Entries for a
   * number still cooling down are skipped instead of blocking the queue, so a
   * burst aimed at one customer never delays everyone else's order updates.
   */
  async claimNext(now: number): Promise<OutboxEntry | null> {
    const candidates = await this.prisma.whatsAppOutbox.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: new Date(now) } },
      orderBy: [{ priority: 'desc' }, { nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: 25,
    });
    for (const c of candidates) {
      if (phoneReady(now, await this.lastSentToPhone(c.phone), this.config.whatsappQueue)) {
        return { id: c.id, phone: c.phone, kind: c.kind, body: c.body, payload: c.payload, meta: c.meta, attempts: c.attempts, messageId: c.messageId };
      }
    }
    return null;
  }

  async markSent(entry: OutboxEntry, providerMessageId: string | null) {
    const sentAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.whatsAppOutbox.update({
        where: { id: entry.id },
        data: { status: 'SENT', sentAt, attempts: entry.attempts + 1, lastError: null },
      });
      if (entry.messageId) {
        await tx.whatsAppMessage.update({
          where: { id: entry.messageId },
          data: { status: 'sent', error: null, meta: mergeMeta(entry.meta, providerMessageId) },
        });
      }
    });
  }

  /** Applies the retry policy. Returns true when the entry is permanently dead. */
  async markFailure(entry: OutboxEntry, err: unknown): Promise<boolean> {
    const attempts = entry.attempts + 1;
    const retryable = err instanceof WhatsAppSendError ? err.retryable : true;
    const message = err instanceof Error ? err.message : String(err);
    const outcome = onFailure(attempts, retryable, this.config.whatsappQueue);

    await this.prisma.$transaction(async (tx) => {
      await tx.whatsAppOutbox.update({
        where: { id: entry.id },
        data: { status: outcome.status, attempts, nextAttemptAt: outcome.nextAttemptAt, lastError: message.slice(0, 500) },
      });
      if (outcome.status === 'FAILED' && entry.messageId) {
        await tx.whatsAppMessage.update({ where: { id: entry.messageId }, data: { status: 'failed', error: message.slice(0, 500) } });
      }
    });

    if (outcome.status === 'FAILED') {
      this.logger.error(`Desisti de enviar para ${entry.phone} após ${attempts} tentativa(s): ${message}`);
      return true;
    }
    const waitSeconds = Math.round((outcome.nextAttemptAt.getTime() - Date.now()) / 1000);
    this.logger.warn(
      `Envio para ${entry.phone} falhou na tentativa ${attempts}/${this.config.whatsappQueue.maxAttempts}; tento de novo em ~${waitSeconds}s: ${message}`,
    );
    return false;
  }

  /** Queue health for the admin panel. */
  async stats() {
    const now = new Date();
    const [pending, failed, due, oldest] = await Promise.all([
      this.prisma.whatsAppOutbox.count({ where: { status: 'PENDING' } }),
      this.prisma.whatsAppOutbox.count({ where: { status: 'FAILED' } }),
      this.prisma.whatsAppOutbox.count({ where: { status: 'PENDING', nextAttemptAt: { lte: now } } }),
      this.prisma.whatsAppOutbox.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);
    return { pending, due, retrying: pending - due, failed, oldestPendingAt: oldest?.createdAt ?? null };
  }

  /** Keeps the table bounded; the readable history lives in WhatsAppMessage. */
  async pruneSent(olderThanDays = 30) {
    const { count } = await this.prisma.whatsAppOutbox.deleteMany({
      where: { status: 'SENT', sentAt: { lt: new Date(Date.now() - olderThanDays * 86_400_000) } },
    });
    return count;
  }
}

/** Adds the provider's message id to the transcript meta, leaving the rest intact. */
function mergeMeta(meta: string | null, providerMessageId: string | null): string | null {
  if (!providerMessageId) return meta;
  let parsed: Record<string, unknown> = {};
  if (meta) {
    try {
      parsed = JSON.parse(meta) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  return JSON.stringify({ ...parsed, providerMessageId });
}
