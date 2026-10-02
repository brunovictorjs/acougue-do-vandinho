import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQuery } from '../../../shared/application/pagination.js';
import { Roles } from '../../../shared/presentation/auth.js';
import { AdminAddressesService } from '../application/admin-addresses.service.js';
import type { CoverageFilter } from '../application/admin-addresses.service.js';

class ListAddressesQuery extends PageQuery {
  @IsOptional() @IsIn(['all', 'served', 'unserved']) status?: CoverageFilter;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
}

@Roles('ADMIN')
@Controller('admin/addresses')
export class AdminAddressesController {
  constructor(private readonly addresses: AdminAddressesService) {}

  @Get()
  list(@Query() q: ListAddressesQuery) {
    return this.addresses.list(q);
  }

  @Get('pending')
  pending() {
    return this.addresses.pendingNeighborhoods();
  }
}
