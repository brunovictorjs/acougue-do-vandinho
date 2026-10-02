import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessRuleError } from '../../../shared/domain/errors.js';
import { PaymentGateway, RefundResult, StartedPayment, StartPaymentInput } from '../domain/payment-gateway.js';

/**
 * Local stand-in for Stripe. Produces a Pix "copia e cola" string that is not
 * payable; the customer (or you, testing) confirms it with the
 * "Simular pagamento" button, which follows the exact same code path as the
 * Stripe webhook. Refunds complete immediately.
 */
@Injectable()
export class FakePaymentGateway extends PaymentGateway {
  readonly name = 'fake' as const;
  private readonly logger = new Logger('FakePayments');

  async start(input: StartPaymentInput): Promise<StartedPayment> {
    if (!input.method) throw new BusinessRuleError('Escolha a forma de pagamento.');
    const id = `fake_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    this.logger.log(`Pagamento simulado ${id} criado para ${input.orderCode} (${input.method}, ${input.amountCents} centavos)`);
    const pix =
      input.method === 'PIX'
        ? {
            code: `00020126580014BR.GOV.BCB.PIX0136${randomUUID()}5204000053039865406${(input.amountCents / 100).toFixed(2)}5802BR5920ACOUGUE DO VANDINHO6009SAO PAULO62${String(input.orderCode.length + 4).padStart(2, '0')}05${String(input.orderCode.length).padStart(2, '0')}${input.orderCode}6304SIMU`,
            qrImageUrl: null,
            expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000),
          }
        : null;
    return { providerPaymentId: id, clientSecret: null, method: input.method, pix };
  }

  async cancel(providerPaymentId: string): Promise<void> {
    this.logger.log(`Pagamento simulado ${providerPaymentId} cancelado`);
  }

  async refund(providerPaymentId: string, amountCents: number, orderCode: string): Promise<RefundResult> {
    this.logger.log(`Reembolso simulado de ${amountCents} centavos para ${orderCode} (${providerPaymentId})`);
    return { providerRefundId: `fake_re_${randomUUID().slice(0, 12)}`, completed: true };
  }
}
