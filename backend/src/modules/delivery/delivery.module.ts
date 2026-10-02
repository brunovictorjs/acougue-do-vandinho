import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { StoreModule } from '../store/store.module.js';
import { CourierPayoutsService } from './application/courier-payouts.service.js';
import { DeliveriesService } from './application/deliveries.service.js';
import { DeliveryRepository } from './infrastructure/delivery.repository.js';
import { RoutePlanner } from './infrastructure/route-planner.js';
import { AdminCourierPayoutsController, AdminDeliveriesController, CourierController, CourierEarningsController } from './presentation/delivery.controller.js';

@Module({
  imports: [StoreModule, IdentityModule],
  controllers: [CourierController, CourierEarningsController, AdminDeliveriesController, AdminCourierPayoutsController],
  providers: [DeliveriesService, CourierPayoutsService, DeliveryRepository, RoutePlanner],
  exports: [DeliveriesService],
})
export class DeliveryModule {}
