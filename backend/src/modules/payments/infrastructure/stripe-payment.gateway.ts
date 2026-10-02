import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { AppConfig } from '../../../config/app-config.js';
import type { PaymentMethodKind } from '../../../shared/application/integration-events.js';
import { PaymentGateway, RefundResult, StartedPayment, StartPaymentInput } from '../domain/payment-gateway.js';

/**
 * Stripe adapter: Checkout Sessions API with `ui_mode: "elements"`, rendered
 * by the Payment Element on our checkout page. Payment methods (Pix, cards)
 * are NOT hard-coded — enable them in the Stripe Dashboard. Fulfilment only
 * happens through the webhook (see StripeWebhookController).
 */
@Injectable()
export class StripePaymentGateway extends PaymentGateway {
  readonly name = 'stripe' as const;
  private readonly logger = new Logger('Stripe');
  readonly client: Stripe;
  private readonly integrationId = `vandinho-web-${randomLetters(8)}`;

  constructor(private readonly config: AppConfig) {
    super();
    this.client = new Stripe(config.payments.stripeSecretKey);
  }

  async start(input: StartPaymentInput): Promise<StartedPayment> {
    // Checkout Sessions accept an expiry between 30 minutes and 24 hours.
    const minutes = Math.min(Math.max(input.expiresInMinutes, 30), 24 * 60);
    const session = await this.client.checkout.sessions.create({
      ui_mode: 'elements',
      mode: 'payment',
      currency: 'brl',
      customer_email: input.customerEmail,
      line_items: input.lines.map((l) => ({
        quantity: 1,
        price_data: { currency: 'brl', unit_amount: l.amountCents, product_data: { name: l.name } },
      })),
      return_url: `${this.config.frontendUrl}/pedidos/${input.orderId}/pagamento?session_id={CHECKOUT_SESSION_ID}`,
      expires_at: Math.floor(Date.now() / 1000) + minutes * 60,
      metadata: { orderId: input.orderId, orderCode: input.orderCode },
      payment_intent_data: { metadata: { orderId: input.orderId, orderCode: input.orderCode } },
      integration_identifier: this.integrationId,
    } as Stripe.Checkout.SessionCreateParams);
    if (!session.client_secret) throw new Error('Stripe did not return a client secret');
    return { providerPaymentId: session.id, clientSecret: session.client_secret, method: null, pix: null };
  }

  async cancel(providerPaymentId: string): Promise<void> {
    try {
      const session = await this.client.checkout.sessions.retrieve(providerPaymentId);
      if (session.status === 'open') await this.client.checkout.sessions.expire(providerPaymentId);
    } catch (err) {
      this.logger.warn(`Could not expire session ${providerPaymentId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async refund(providerPaymentId: string, amountCents: number, orderCode: string): Promise<RefundResult> {
    const session = await this.client.checkout.sessions.retrieve(providerPaymentId);
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntent) throw new Error(`Session ${providerPaymentId} has no payment intent to refund`);
    const refund = await this.client.refunds.create({ payment_intent: paymentIntent, amount: amountCents, metadata: { orderCode } });
    return { providerRefundId: refund.id, completed: refund.status === 'succeeded' };
  }

  /** Which method the customer actually used (Pix, credit or debit card). */
  async methodOfSession(session: Stripe.Checkout.Session): Promise<PaymentMethodKind> {
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!piId) return 'CREDIT_CARD';
    const pi = await this.client.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
    const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
    const details = charge?.payment_method_details;
    if (details?.type === 'pix') return 'PIX';
    if (details?.type === 'card') return details.card?.funding === 'debit' ? 'DEBIT_CARD' : 'CREDIT_CARD';
    return 'CREDIT_CARD';
  }
}

function randomLetters(n: number) {
  const abc = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from(randomBytes(n), (b) => abc[b % abc.length]).join('');
}
