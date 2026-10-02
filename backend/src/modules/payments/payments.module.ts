import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { StoreModule } from '../store/store.module.js';
import { PaymentsService } from './application/payments.service.js';
import { PaymentGateway } from './domain/payment-gateway.js';
import { FakePaymentGateway } from './infrastructure/fake-payment.gateway.js';
import { StripePaymentGateway } from './infrastructure/stripe-payment.gateway.js';
import { PaymentsController, StripeWebhookController } from './presentation/payments.controller.js';

@Module({
  imports: [StoreModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [
    PaymentsService,
    {
      provide: PaymentGateway,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        if (config.payments.provider === 'stripe') {
          if (!config.payments.stripeSecretKey || !config.payments.stripeWebhookSecret) {
            throw new Error('PAYMENT_PROVIDER=stripe requer STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET.');
          }
          return new StripePaymentGateway(config);
        }
        return new FakePaymentGateway();
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
