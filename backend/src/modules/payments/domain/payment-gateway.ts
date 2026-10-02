import type { PaymentMethodKind } from '../../../shared/application/integration-events.js';

export interface StartPaymentInput {
  orderId: string;
  orderCode: string;
  amountCents: number;
  lines: Array<{ name: string; amountCents: number }>;
  customerEmail: string;
  /** Required by the simulated gateway; Stripe lets the customer pick in the Payment Element. */
  method: PaymentMethodKind | null;
  expiresInMinutes: number;
}

export interface StartedPayment {
  providerPaymentId: string;
  clientSecret: string | null;
  method: PaymentMethodKind | null;
  pix: { code: string; qrImageUrl: string | null; expiresAt: Date } | null;
}

export interface RefundResult {
  providerRefundId: string;
  completed: boolean;
}

/** Port implemented by StripePaymentGateway and FakePaymentGateway. */
export abstract class PaymentGateway {
  abstract readonly name: 'stripe' | 'fake';
  abstract start(input: StartPaymentInput): Promise<StartedPayment>;
  abstract cancel(providerPaymentId: string): Promise<void>;
  abstract refund(providerPaymentId: string, amountCents: number, orderCode: string): Promise<RefundResult>;
}
