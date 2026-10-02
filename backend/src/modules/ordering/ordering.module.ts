import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { StoreModule } from '../store/store.module.js';
import { CartService } from './application/cart.service.js';
import { CheckoutService } from './application/checkout.service.js';
import { OrdersService } from './application/orders.service.js';
import { PricingAdapter } from './application/pricing.adapter.js';
import { OrderRepository } from './infrastructure/order.repository.js';
import { AdminOrdersController, CartController, OrdersController } from './presentation/ordering.controller.js';

@Module({
  imports: [CatalogModule, DeliveryModule, IdentityModule, PaymentsModule, StoreModule],
  controllers: [CartController, OrdersController, AdminOrdersController],
  providers: [OrderRepository, PricingAdapter, CartService, CheckoutService, OrdersService],
  exports: [OrdersService],
})
export class OrderingModule {}
