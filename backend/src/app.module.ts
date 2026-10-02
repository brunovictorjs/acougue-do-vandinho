import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'node:path';
import { AppConfig } from './config/app-config.js';
import { AssistantModule } from './modules/assistant/assistant.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { DeliveryModule } from './modules/delivery/delivery.module.js';
import { FavoritesModule } from './modules/favorites/favorites.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { OrderingModule } from './modules/ordering/ordering.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { StoreModule } from './modules/store/store.module.js';
import { SupportModule } from './modules/support/support.module.js';
import { SharedModule } from './shared/shared.module.js';
import { SessionGuard } from './shared/presentation/auth.js';
import { DomainExceptionFilter } from './shared/presentation/domain-exception.filter.js';

const config = new AppConfig();

/**
 * Modular monolith. Each bounded context lives in src/modules/<context> with
 * domain / application / infrastructure / presentation layers; contexts talk
 * through exported application services and integration events.
 */
@Module({
  imports: [
    SharedModule,
    EventEmitterModule.forRoot(),
    JwtModule.register({ global: true, secret: config.jwtSecret }),
    ServeStaticModule.forRoot({
      rootPath: path.resolve(config.uploads.dir),
      serveRoot: config.uploads.publicPath,
      serveStaticOptions: { index: false, fallthrough: false },
    }),
    IdentityModule,
    CustomersModule,
    StoreModule,
    SupportModule,
    CatalogModule,
    FavoritesModule,
    ReviewsModule,
    OrderingModule,
    PaymentsModule,
    DeliveryModule,
    MessagingModule,
    AssistantModule,
    FinanceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
