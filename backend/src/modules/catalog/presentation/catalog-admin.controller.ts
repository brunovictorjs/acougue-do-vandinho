import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQuery } from '../../../shared/application/pagination.js';
import { BusinessRuleError } from '../../../shared/domain/errors.js';
import { Roles } from '../../../shared/presentation/auth.js';
import { CategoriesService } from '../application/categories.service.js';
import { OffersService } from '../application/offers.service.js';
import { ProductsAdminService } from '../application/products-admin.service.js';
import type { DiscountKind } from '../domain/pricing.js';

class ListProductsQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() categoryId?: string;
}

class ProductDto {
  @IsString() @Length(1, 100) name!: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsString() categoryId!: string;
  @IsIn(['KG', 'UNIT', 'PACK']) unit!: 'KG' | 'UNIT' | 'PACK';
  @IsInt() @Min(1) priceCents!: number;
  @IsString() @MaxLength(200) shortDescription!: string;
  @IsString() @MaxLength(20000) description!: string;
  @IsBoolean() published!: boolean;
  @IsBoolean() available!: boolean;
  @IsBoolean() isNew!: boolean;
  @IsOptional() @IsString() newUntil?: string | null;
  @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) cutOptions!: string[];
  @IsNumber() minQuantity!: number;
  @IsNumber() quantityStep!: number;
}

class FlagsDto {
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsBoolean() isNew?: boolean;
}

class IdsDto {
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) ids!: string[];
}

class CategoryDto {
  @IsString() @Length(1, 60) name!: string;
}

class OfferDto {
  @IsString() @Length(1, 80) name!: string;
  @IsIn(['PERCENT', 'AMOUNT', 'FIXED_PRICE']) discountType!: DiscountKind;
  @IsInt() value!: number;
  @IsString() startsAt!: string;
  @IsOptional() @IsString() endsAt?: string | null;
  @IsBoolean() active!: boolean;
  @IsBoolean() showBadge!: boolean;
  @IsBoolean() featured!: boolean;
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) productIds!: string[];
}

class ActiveDto {
  @IsBoolean() active!: boolean;
}

@Roles('EMPLOYEE')
@Controller('admin')
export class CatalogAdminController {
  constructor(
    private readonly products: ProductsAdminService,
    private readonly categories: CategoriesService,
    private readonly offers: OffersService,
  ) {}

  // ---------------- products
  @Get('products')
  listProducts(@Query() q: ListProductsQuery) {
    return this.products.list(q);
  }

  @Get('products/options')
  productOptions() {
    return this.products.options();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.products.get(id);
  }

  @Post('products')
  createProduct(@Body() dto: ProductDto) {
    return this.products.create(dto);
  }

  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: ProductDto) {
    return this.products.update(id, dto);
  }

  @Patch('products/:id/flags')
  flags(@Param('id') id: string, @Body() dto: FlagsDto) {
    return this.products.patchFlags(id, dto);
  }

  @Delete('products/:id')
  removeProduct(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Post('products/:id/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  addMedia(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File, @Body('alt') alt?: string) {
    if (!file) throw new BusinessRuleError('Envie um arquivo.');
    return this.products.addMedia(id, file, alt ?? '');
  }

  @Put('products/:id/media/order')
  reorderMedia(@Param('id') id: string, @Body() dto: IdsDto) {
    return this.products.reorderMedia(id, dto.ids);
  }

  @Delete('products/:id/media/:mediaId')
  removeMedia(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.products.removeMedia(id, mediaId);
  }

  // ---------------- categories
  @Get('categories')
  listCategories() {
    return this.categories.list();
  }

  @Post('categories')
  createCategory(@Body() dto: CategoryDto) {
    return this.categories.save(dto.name);
  }

  @Put('categories/order')
  reorderCategories(@Body() dto: IdsDto) {
    return this.categories.reorder(dto.ids);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) {
    return this.categories.save(dto.name, id);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.categories.remove(id);
  }

  // ---------------- offers
  @Get('offers')
  listOffers(@Query() q: PageQuery) {
    return this.offers.list(q.page);
  }

  @Post('offers')
  createOffer(@Body() dto: OfferDto) {
    return this.offers.create(dto);
  }

  @Put('offers/:id')
  updateOffer(@Param('id') id: string, @Body() dto: OfferDto) {
    return this.offers.update(id, dto);
  }

  @Patch('offers/:id/active')
  setOfferActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.offers.setActive(id, dto.active);
  }

  @Delete('offers/:id')
  removeOffer(@Param('id') id: string) {
    return this.offers.remove(id);
  }
}
