import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Events,
  type OrderCancelledEvent,
  type PaymentMethodKind,
} from '../../../shared/application/integration-events.js';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../../shared/domain/errors.js';
import { DomainEventPublisher } from '../../../shared/infrastructure/events/domain-event-publisher.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { StoreSettingsService } from '../../store/application/store-settings.service.js';
import { PaymentGateway, StartPaymentInput } from '../domain/payment-gateway.js';

export interface PaymentView {
  id: string;
  provider: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  method: PaymentMethodKind;
  amountCents: number;
  clientSecret: string | null;
  pix: { code: string; qrImageUrl: string | null; expiresAt: Date | null } | null;
  succeededAt: Date | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGateway,
    private readonly events: DomainEventPublisher,
    private readonly store: StoreSettingsService,
  ) {}

  get provider() {
    return this.gateway.name;
  }

  private view(p: {
    id: string;
    provider: string;
    status: PaymentView['status'];
    method: PaymentMethodKind;
    amountCents: number;
    clientSecret: string | null;
    pixCode: string | null;
    pixQrImageUrl: string | null;
    pixExpiresAt: Date | null;
    succeededAt: Date | null;
  }): PaymentView {
    return {
      id: p.id,
      provider: p.provider,
      status: p.status,
      method: p.method,
      amountCents: p.amountCents,
      clientSecret: p.status === 'PENDING' ? p.clientSecret : null,
      pix: p.pixCode ? { code: p.pixCode, qrImageUrl: p.pixQrImageUrl, expiresAt: p.pixExpiresAt } : null,
      succeededAt: p.succeededAt,
    };
  }

  /** Starts a fresh payment attempt for the order, voiding older pending ones. */
  async start(input: Omit<StartPaymentInput, 'expiresInMinutes'>): Promise<PaymentView> {
    await this.cancelPending(input.orderId);
    const settings = await this.store.get();
    const started = await this.gateway.start({
      ...input,
      lines: input.lines.filter((l) => l.amountCents > 0),
      expiresInMinutes: settings.pixExpirationMinutes,
    });
    const payment = await this.prisma.payment.create({
      data: {
        orderId: input.orderId,
        provider: this.gateway.name,
        providerPaymentId: started.providerPaymentId,
        // Stripe decides the method in the Payment Element; PIX is a placeholder until the webhook.
        method: started.method ?? input.method ?? 'PIX',
        amountCents: input.amountCents,
        clientSecret: started.clientSecret,
        pixCode: started.pix?.code ?? null,
        pixQrImageUrl: started.pix?.qrImageUrl ?? null,
        pixExpiresAt: started.pix?.expiresAt ?? null,
      },
    });
    return this.view(payment);
  }

  /** Called when the cart changes after checkout started: the old amount is no longer valid. */
  async cancelPending(orderId: string) {
    const pending = await this.prisma.payment.findMany({ where: { orderId, status: 'PENDING' } });
    for (const p of pending) {
      await this.gateway.cancel(p.providerPaymentId);
      await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'CANCELED' } });
    }
  }

  async latestForOrder(orderId: string): Promise<PaymentView | null> {
    const p = await this.prisma.payment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    return p ? this.view(p) : null;
  }

  async refundForOrder(orderId: string) {
    const r = await this.prisma.refund.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    return r ? { status: r.status, amountCents: r.amountCents, createdAt: r.createdAt, completedAt: r.completedAt } : null;
  }

  // ------------------------------------------------------------ settlement

  /** Single entry point for "money arrived" — used by the Stripe webhook and the simulator. */
  async markSucceeded(providerPaymentId: string, method: PaymentMethodKind | null) {
    const p = await this.prisma.payment.findUnique({ where: { providerPaymentId } });
    if (!p) {
      this.logger.warn(`Pagamento desconhecido ${providerPaymentId}`);
      return;
    }
    if (p.status === 'SUCCEEDED') return; // webhook retries
    if (p.status === 'CANCELED') {
      // The cart changed while the customer was paying: give the money back.
      this.logger.warn(`Pagamento ${p.id} aprovado depois de cancelado — reembolsando automaticamente.`);
      await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'SUCCEEDED', succeededAt: new Date(), method: method ?? p.method } });
      await this.refund(p.id, p.orderId);
      return;
    }
    const updated = await this.prisma.payment.update({
      where: { id: p.id },
      data: { status: 'SUCCEEDED', succeededAt: new Date(), method: method ?? p.method },
    });
    this.events.publish({
      name: Events.PaymentSucceeded,
      paymentId: updated.id,
      orderId: updated.orderId,
      method: updated.method,
      amountCents: updated.amountCents,
    });
  }

  async markFailed(providerPaymentId: string, status: 'FAILED' | 'CANCELED') {
    const p = await this.prisma.payment.findUnique({ where: { providerPaymentId } });
    if (!p || p.status !== 'PENDING') return;
    await this.prisma.payment.update({ where: { id: p.id }, data: { status } });
    this.events.publish({ name: Events.PaymentFailed, paymentId: p.id, orderId: p.orderId });
  }

  /** Dev/test only: confirms a simulated payment as if the bank had paid it. */
  async simulate(paymentId: string, userId: string) {
    if (this.gateway.name !== 'fake') throw new ForbiddenError('Simulação disponível apenas no modo de pagamentos simulado.');
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { userId: true } } } });
    if (!p || p.order.userId !== userId) throw new NotFoundError('Pagamento');
    if (p.status !== 'PENDING') throw new BusinessRuleError('Este pagamento não está mais pendente.');
    await this.markSucceeded(p.providerPaymentId, p.method);
    return { ok: true };
  }

  // ------------------------------------------------------------ refunds

  @OnEvent(Events.OrderCancelled)
  async onOrderCancelled(e: OrderCancelledEvent) {
    const paid = await this.prisma.payment.findFirst({ where: { orderId: e.orderId, status: 'SUCCEEDED' }, orderBy: { succeededAt: 'desc' } });
    if (!paid) {
      this.logger.warn(`Pedido ${e.orderCode} cancelado sem pagamento aprovado — nada a reembolsar.`);
      return;
    }
    await this.refund(paid.id, e.orderId);
  }

  private async refund(paymentId: string, orderId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const already = await this.prisma.refund.findFirst({ where: { paymentId, status: { in: ['PENDING', 'SUCCEEDED'] } } });
    if (already) return;
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { code: true } });
    const refund = await this.prisma.refund.create({ data: { paymentId, orderId, amountCents: payment.amountCents } });
    try {
      const result = await this.gateway.refund(payment.providerPaymentId, payment.amountCents, order.code);
      await this.prisma.refund.update({ where: { id: refund.id }, data: { providerRefundId: result.providerRefundId } });
      if (result.completed) {
        // The simulator settles instantly; wait a moment so messages arrive in a natural order.
        const delay = this.gateway.name === 'fake' ? 1500 : 0;
        setTimeout(() => void this.completeRefund(refund.id).catch((e: unknown) => this.logger.error('Falha ao concluir reembolso', String(e))), delay);
      }
    } catch (err) {
      this.logger.error(`Falha ao reembolsar ${order.code}`, err instanceof Error ? err.stack : String(err));
      await this.prisma.refund.update({ where: { id: refund.id }, data: { status: 'FAILED' } });
    }
  }

  /** Stripe refund webhooks land here too (by provider refund id). */
  async completeRefundByProviderId(providerRefundId: string, succeeded: boolean) {
    const r = await this.prisma.refund.findUnique({ where: { providerRefundId } });
    if (!r || r.status !== 'PENDING') return;
    if (!succeeded) {
      await this.prisma.refund.update({ where: { id: r.id }, data: { status: 'FAILED' } });
      return;
    }
    await this.completeRefund(r.id);
  }

  private async completeRefund(refundId: string) {
    const r = await this.prisma.refund.update({ where: { id: refundId }, data: { status: 'SUCCEEDED', completedAt: new Date() } });
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: r.orderId }, select: { code: true, userId: true } });
    this.events.publish({ name: Events.RefundCompleted, orderId: r.orderId, orderCode: order.code, userId: order.userId, amountCents: r.amountCents });
  }

  /** Admin retry for refunds that failed at the provider. */
  async retryRefund(orderId: string) {
    const failed = await this.prisma.refund.findFirst({ where: { orderId, status: 'FAILED' }, orderBy: { createdAt: 'desc' } });
    if (!failed) throw new BusinessRuleError('Não há reembolso com falha para este pedido.');
    await this.prisma.refund.delete({ where: { id: failed.id } });
    await this.refund(failed.paymentId, orderId);
    return this.refundForOrder(orderId);
  }
}
