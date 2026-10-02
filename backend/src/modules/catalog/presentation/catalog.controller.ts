import { Controller, Get, Param, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Public } from '../../../shared/presentation/auth.js';
import type { ProductSort } from '../application/catalog-query.service.js';
import { CatalogQueryService } from '../application/catalog-query.service.js';

const SORTS: ProductSort[] = ['popular', 'price_asc', 'price_desc', 'rating', 'newest'];

class ListProductsQuery {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(SORTS) sort?: ProductSort;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() offers?: boolean;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(48) pageSize?: number;
}

@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogQueryService) {}

  @Get('home')
  home() {
    return this.catalog.home();
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  list(@Query() q: ListProductsQuery) {
    return this.catalog.list({ ...q, offersOnly: q.offers });
  }

  @Get('products/:slug')
  async bySlug(@Param('slug') slug: string) {
    const product = await this.catalog.bySlug(slug);
    return { product, related: await this.catalog.related(product.id) };
  }
}
