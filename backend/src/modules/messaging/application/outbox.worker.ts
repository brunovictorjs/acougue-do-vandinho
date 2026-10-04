import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { globalBlock } from '../domain/outbox-policy.js';
import { LocationMessage, WhatsAppGateway } from '../domain/whatsapp-gateway.js';
import { OutboxEntry, WhatsAppOutboxStore } from './outbox.service.js';

/**
 * Drains the outbox, one message per tick at most. This is the only place in
 * the app that calls a WhatsApp gateway, which is what makes the rate limits
 * in AppConfig.whatsappQueue impossible to bypass by accident.
 *
 * Single-process by design: the `draining` guard keeps ticks from overlapping.
 * Running two API instances against the same database would need row-level
 * claiming (an UPDATE ... WHERE status = 'PENDING' returning the row) first.
 */
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WhatsAppOutbox');
  private timer: NodeJS.Timeout | null = null;
  private draining = false;
  private lastBlockLoggedAt = 0;

  constructor(
    private readonly store: WhatsAppOutboxStore,
    private readonly gateway: WhatsAppGateway,
    private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    const p = this.config.whatsappQueue;
    this.timer = setInterval(() => void this.tick(), p.tickMs);
    this.timer.unref?.();
    this.logger.log(
      `Fila de saída ativa: 1 msg a cada ${p.minIntervalMs / 1000}s, máx ${p.perMinuteLimit}/min, ${p.perPhoneIntervalMs / 1000}s por número, até ${p.maxAttempts} tentativas.`,
    );
    void this.store.pruneSent().then((n) => n > 0 && this.logger.log(`${n} entrada(s) antiga(s) removida(s) da fila.`));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Exposed for tests and for the admin "drenar agora" action. */
  async tick(): Promise<'idle' | 'sent' | 'failed' | 'held'> {
    if (this.draining) return 'held';
    this.draining = true;
    try {
      const now = Date.now();
      const [lastSentAt, sentLastMinute] = await Promise.all([this.store.lastSentAt(), this.store.countSentLastMinute(now)]);

      const block = globalBlock({ now, lastSentAt, sentLastMinute }, this.config.whatsappQueue);
      if (block) {
        if (block === 'per-minute' && now - this.lastBlockLoggedAt > 60_000) {
          this.lastBlockLoggedAt = now;
          this.logger.warn(`Limite de ${this.config.whatsappQueue.perMinuteLimit} mensagens/minuto atingido — a fila segue parada até liberar.`);
        }
        return 'held';
      }

      const entry = await this.store.claimNext(now);
      if (!entry) return 'idle';
      return (await this.send(entry)) ? 'sent' : 'failed';
    } catch (err) {
      this.logger.error('Erro ao drenar a fila', err instanceof Error ? err.stack : String(err));
      return 'failed';
    } finally {
      this.draining = false;
    }
  }

  private async send(entry: OutboxEntry): Promise<boolean> {
    try {
      const result = entry.kind === 'location' ? await this.gateway.sendLocation(entry.phone, this.location(entry)) : await this.gateway.sendText(entry.phone, entry.body);
      await this.store.markSent(entry, result.providerMessageId);
      return true;
    } catch (err) {
      await this.store.markFailure(entry, err);
      return false;
    }
  }

  private location(entry: OutboxEntry): LocationMessage {
    const p = (entry.payload ? JSON.parse(entry.payload) : {}) as Partial<LocationMessage>;
    return {
      latitude: Number(p.latitude ?? 0),
      longitude: Number(p.longitude ?? 0),
      title: p.title ?? '',
      address: p.address ?? entry.body,
    };
  }
}
