import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { IdentityModule } from '../identity/identity.module.js';
import { StoreModule } from '../store/store.module.js';
import { AdminMailer } from './application/admin-mailer.service.js';
import { AdminOrderEmailsHandler } from './application/admin-order-emails.handler.js';
import { InboundService } from './application/inbound.service.js';
import { OrderNotificationsHandler } from './application/order-notifications.handler.js';
import { WhatsAppOutboxStore } from './application/outbox.service.js';
import { OutboxWorker } from './application/outbox.worker.js';
import { WhatsAppSender } from './application/whatsapp-sender.service.js';
import { EmailGateway } from './domain/email-gateway.js';
import { WhatsAppGateway } from './domain/whatsapp-gateway.js';
import { LogEmailGateway } from './infrastructure/log-email.gateway.js';
import { LogWhatsAppGateway } from './infrastructure/log-whatsapp.gateway.js';
import { ResendEmailGateway } from './infrastructure/resend-email.gateway.js';
import { ZApiWhatsAppGateway } from './infrastructure/zapi-whatsapp.gateway.js';
import { AdminWhatsAppController, ZApiWebhookController } from './presentation/messaging.controller.js';

@Module({
  imports: [IdentityModule, StoreModule],
  controllers: [ZApiWebhookController, AdminWhatsAppController],
  providers: [
    WhatsAppSender,
    WhatsAppOutboxStore,
    OutboxWorker,
    InboundService,
    OrderNotificationsHandler,
    AdminMailer,
    AdminOrderEmailsHandler,
    {
      provide: EmailGateway,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        if (config.email.provider === 'resend') {
          if (!config.email.resendApiKey) throw new Error('EMAIL_PROVIDER=resend requer RESEND_API_KEY.');
          return new ResendEmailGateway(config);
        }
        return new LogEmailGateway();
      },
    },
    {
      provide: WhatsAppGateway,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        if (config.whatsapp.provider === 'zapi') {
          const { zapiInstanceId, zapiToken } = config.whatsapp;
          if (!zapiInstanceId || !zapiToken) throw new Error('WHATSAPP_PROVIDER=zapi requer ZAPI_INSTANCE_ID e ZAPI_TOKEN.');
          return new ZApiWhatsAppGateway(config);
        }
        return new LogWhatsAppGateway();
      },
    },
  ],
  exports: [WhatsAppSender],
})
export class MessagingModule {}
