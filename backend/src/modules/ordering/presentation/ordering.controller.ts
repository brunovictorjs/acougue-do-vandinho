import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser, RequireOnboarding, Roles } from '../../../shared/presentation/auth.js';
import type { AuthUser } from '../../../shared/presentation/auth.js';
import { CartService } from '../application/cart.service.js';
import { CheckoutService } from '../application/checkout.service.js';
import { OrdersService } from '../application/orders.service.js';

const STATUSES = ['CART', 'PAID', 'CANCELLED'] as const;
const METHODS = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD'] as const;

class AddItemDto {
  @IsString() productId!: string;
  @IsNumber() quantity!: number;
  @IsOptional() @IsString() @MaxLength(40) cutOption?: string;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

class QuantityDto {
  @IsNumber() quantity!: number;
}

class CheckoutDto {
  @IsIn(['DELIVERY', 'PICKUP']) fulfillment!: 'DELIVERY' | 'PICKUP';
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
}

class CancelDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

class MyOrdersQuery {
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
}

class AdminOrdersQuery {
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsIn(['DELIVERY', 'PICKUP']) fulfillment?: 'DELIVERY' | 'PICKUP';
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page?: number;
}

@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly checkout: CheckoutService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.cart.get(user.id);
  }

  @RequireOnboarding()
  @Post('items')
  add(@CurrentUser() user: AuthUser, @Body() dto: AddItemDto) {
    return this.cart.add(user.id, dto);
  }

  @Patch('items/:itemId')
  update(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string, @Body() dto: QuantityDto) {
    return this.cart.updateQuantity(user.id, itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  remove(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.cart.remove(user.id, itemId);
  }

  @RequireOnboarding()
  @Post('checkout')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.checkout.start(user.id, dto);
  }
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: MyOrdersQuery) {
    return this.orders.listMine(user.id, q.status);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.detailMine(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.orders.cancelMine(user.id, id, dto.reason ?? null);
  }
}

/** Orders back office. Employees see orders and hand over pickups; cancelling (refund) is admin-only. */
@Roles('EMPLOYEE')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() q: AdminOrdersQuery) {
    return this.orders.adminList(q);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.orders.adminDetail(id);
  }

  @Post(':id/picked-up')
  @HttpCode(200)
  pickedUp(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.markPickedUp(id, user.id);
  }

  @Roles('ADMIN')
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @Body() dto: CancelDto) {
    return this.orders.adminCancel(id, dto.reason ?? null);
  }
}
