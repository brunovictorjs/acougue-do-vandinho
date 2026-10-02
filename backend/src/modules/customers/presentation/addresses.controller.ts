import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../shared/presentation/auth.js';
import type { AuthUser } from '../../../shared/presentation/auth.js';
import { AddressesService } from '../application/addresses.service.js';

class AddressDto {
  @IsString() @MaxLength(30) label!: string;
  @IsString() @Length(8, 9) zipCode!: string;
  @IsString() @Length(1, 120) street!: string;
  @IsString() @Length(1, 20) number!: string;
  @IsOptional() @IsString() @MaxLength(80) complement?: string;
  @IsString() @Length(1, 80) neighborhood!: string;
  @IsString() @Length(1, 80) city!: string;
  @IsString() @Length(2, 2) state!: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

@Controller('me/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.addresses.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddressDto) {
    return this.addresses.update(user.id, id, dto);
  }

  @Post(':id/default')
  makeDefault(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.makeDefault(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.remove(user.id, id);
  }
}
