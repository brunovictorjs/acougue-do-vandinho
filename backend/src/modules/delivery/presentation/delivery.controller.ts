import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQuery } from '../../../shared/application/pagination.js';
import { CurrentUser, Roles } from '../../../shared/presentation/auth.js';
import type { AuthUser } from '../../../shared/presentation/auth.js';
import { UserDirectory } from '../../identity/application/user-directory.js';
import { CourierPayoutsService } from '../application/courier-payouts.service.js';
import { DeliveriesService } from '../application/deliveries.service.js';

class DeliveredDto {
  @IsString() @MaxLength(20) code!: string;
}

class FailDto {
  @IsString() @MaxLength(60) reason!: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

class PeriodPageQuery extends PageQuery {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

class PayoutDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500) @IsString({ each: true }) deliveryIds!: string[];
}

@Roles('COURIER')
@Controller('courier/deliveries')
export class CourierController {
  constructor(
    private readonly deliveries: DeliveriesService,
    private readonly users: UserDirectory,
  ) {}

  @Get()
  board(@CurrentUser() user: AuthUser) {
    return this.deliveries.courierBoard(user.id);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deliveries.courierDetail(id, user.id);
  }

  @Post(':id/start')
  @HttpCode(200)
  async start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const me = await this.users.contact(user.id);
    return this.deliveries.start(id, { id: user.id, name: me?.fullName ?? user.firstName });
  }

  @Post(':id/delivered')
  @HttpCode(200)
  delivered(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DeliveredDto) {
    return this.deliveries.complete(id, user.id, dto.code);
  }

  @Post(':id/not-delivered')
  @HttpCode(200)
  notDelivered(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FailDto) {
    return this.deliveries.fail(id, user.id, dto.reason, dto.notes ?? null);
  }
}

@Roles('ADMIN')
@Controller('admin/deliveries')
export class AdminDeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  board() {
    return this.deliveries.adminBoard();
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  reschedule(@Param('id') id: string) {
    return this.deliveries.reschedule(id);
  }
}

/** The courier's own fees and payout status (read-only). */
@Roles('COURIER')
@Controller('courier/earnings')
export class CourierEarningsController {
  constructor(private readonly payouts: CourierPayoutsService) {}

  @Get()
  earnings(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.payouts.courierEarnings(user.id, from, to);
  }
}

@Roles('ADMIN')
@Controller('admin/couriers/payouts')
export class AdminCourierPayoutsController {
  constructor(private readonly payouts: CourierPayoutsService) {}

  @Get()
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.payouts.adminSummary(from, to);
  }

  @Get(':courierId')
  deliveries(@Param('courierId') courierId: string, @Query() q: PeriodPageQuery) {
    return this.payouts.courierDeliveries(courierId, q.from, q.to, q.page);
  }

  /** Marks the selected deliveries of one courier as paid. Irreversible. */
  @Post(':courierId')
  @HttpCode(200)
  pay(@CurrentUser() user: AuthUser, @Param('courierId') courierId: string, @Body() dto: PayoutDto) {
    return this.payouts.pay(courierId, dto.deliveryIds, user.id);
  }
}
