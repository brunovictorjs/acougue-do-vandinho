import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { AppConfig } from '../../../config/app-config.js';
import { CurrentUser, Public, Roles } from '../../../shared/presentation/auth.js';
import type { AuthUser } from '../../../shared/presentation/auth.js';
import { PaymentsService } from '../application/payments.service.js';
import { PaymentGateway } from '../domain/payment-gateway.js';
import { StripePaymentGateway } from '../infrastructure/stripe-payment.gateway.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Lets the checkout decide between the simulator UI and the Stripe Payment Element. */
  @Public()
  @Get('config')
  config() {
    return { provider: this.payments.provider };
  }

  /** Test mode only: the "Simular pagamento aprovado" button. */
  @Post(':id/simulate')
  @HttpCode(200)
  simulate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.simulate(id, user.id);
  }

  @Roles('ADMIN')
  @Post('orders/:orderId/refund/retry')
  @HttpCode(200)
  retryRefund(@Param('orderId') orderId: string) {
    return this.payments.retryRefund(orderId);
  }
}

/**
 * Stripe → us. Signature is verified with STRIPE_WEBHOOK_SECRET before any
 * processing. Run locally with:
 *   stripe listen --forward-to localhost:3333/api/webhooks/stripe
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger('StripeWebhook');

  constructor(
    private readonly payments: PaymentsService,
    private readonly gateway: PaymentGateway,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    if (!(this.gateway instanceof StripePaymentGateway)) throw new ServiceUnavailableException('Stripe não está ativo.');
    if (!signature || !req.rawBody) throw new BadRequestException('Assinatura ausente.');
    let event: Stripe.Event;
    try {
      event = this.gateway.client.webhooks.constructEvent(req.rawBody, signature, this.config.payments.stripeWebhookSecret);
    } catch {
      throw new BadRequestException('Assinatura inválida.');
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        // Pix completes the session before the money arrives: only fulfil when paid.
        if (session.payment_status !== 'unpaid') {
          const method = await this.gateway.methodOfSession(session);
          await this.payments.markSucceeded(session.id, method);
        }
        break;
      }
      case 'checkout.session.async_payment_failed':
        await this.payments.markFailed(event.data.object.id, 'FAILED');
        break;
      case 'checkout.session.expired':
        await this.payments.markFailed(event.data.object.id, 'CANCELED');
        break;
      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data.object;
        if (refund.status === 'succeeded') await this.payments.completeRefundByProviderId(refund.id, true);
        else if (refund.status === 'failed' || refund.status === 'canceled') await this.payments.completeRefundByProviderId(refund.id, false);
        break;
      }
      default:
        this.logger.debug(`Ignorado: ${event.type}`);
    }
    return { received: true };
  }
}
