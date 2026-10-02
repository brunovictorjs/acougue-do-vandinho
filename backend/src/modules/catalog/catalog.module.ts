import { Module } from '@nestjs/common';
import { CatalogQueryService } from './application/catalog-query.service.js';
import { CategoriesService } from './application/categories.service.js';
import { OffersService } from './application/offers.service.js';
import { ProductsAdminService } from './application/products-admin.service.js';
import { CatalogAdminController } from './presentation/catalog-admin.controller.js';
import { CatalogController } from './presentation/catalog.controller.js';

@Module({
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogQueryService, ProductsAdminService, CategoriesService, OffersService],
  exports: [CatalogQueryService, ProductsAdminService],
})
export class CatalogModule {}
