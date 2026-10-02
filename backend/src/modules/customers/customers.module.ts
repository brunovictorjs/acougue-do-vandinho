import { Module } from '@nestjs/common';
import { StoreModule } from '../store/store.module.js';
import { AdminAddressesService } from './application/admin-addresses.service.js';
import { AddressesService } from './application/addresses.service.js';
import { Geocoder } from './infrastructure/geocoder.js';
import { AddressesController } from './presentation/addresses.controller.js';
import { AdminAddressesController } from './presentation/admin-addresses.controller.js';

@Module({
  imports: [StoreModule],
  controllers: [AddressesController, AdminAddressesController],
  providers: [AddressesService, AdminAddressesService, Geocoder],
  exports: [AddressesService],
})
export class CustomersModule {}
