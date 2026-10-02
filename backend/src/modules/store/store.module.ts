import { Module } from '@nestjs/common';
import { DeliveryZonesService } from './application/delivery-zones.service.js';
import { StoreSettingsService } from './application/store-settings.service.js';
import { StoreController } from './presentation/store.controller.js';

@Module({
  controllers: [StoreController],
  providers: [StoreSettingsService, DeliveryZonesService],
  exports: [StoreSettingsService, DeliveryZonesService],
})
export class StoreModule {}
