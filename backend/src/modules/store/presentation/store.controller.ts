import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessRuleError } from '../../../shared/domain/errors.js';
import { Public, Roles } from '../../../shared/presentation/auth.js';
import { DeliveryZonesService } from '../application/delivery-zones.service.js';
import { StoreSettingsService } from '../application/store-settings.service.js';

class HoursDto {
  @IsString() @MaxLength(40) label!: string;
  @IsString() @MaxLength(60) value!: string;
}

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(20) cnpj?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => HoursDto) hours?: HoursDto[];
  @IsOptional() @IsString() @MaxLength(2000) about?: string;
  @IsOptional() @IsInt() @Min(5) @Max(1440) pixExpirationMinutes?: number;
  @IsOptional() @IsBoolean() assistantEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(8000) assistantPrompt?: string;
  @IsOptional() @IsObject() notifications?: Record<string, boolean>;
  @IsOptional() @IsObject() adminEmailNotifications?: Record<string, boolean>;
  @IsOptional() @IsString() @MaxLength(60000) privacyPolicy?: string;
  @IsOptional() @IsString() @MaxLength(60000) terms?: string;
}

export class ZoneDto {
  @IsString() @MaxLength(80) neighborhood!: string;
  @IsInt() @Min(0) feeCents!: number;
  @IsInt() @Min(5) @Max(600) etaMinutes!: number;
  @IsBoolean() active!: boolean;
}

@Controller()
export class StoreController {
  constructor(
    private readonly settings: StoreSettingsService,
    private readonly zones: DeliveryZonesService,
  ) {}

  @Public()
  @Get('store')
  info() {
    return this.settings.publicInfo();
  }

  @Public()
  @Get('store/legal')
  legal() {
    return this.settings.legal();
  }

  @Public()
  @Get('store/delivery-quote')
  quote(@Query('neighborhood') neighborhood = '') {
    return this.zones.quote(neighborhood);
  }

  @Roles('ADMIN')
  @Get('admin/settings')
  getSettings() {
    return this.settings.get();
  }

  @Roles('ADMIN')
  @Get('admin/settings/legal-templates')
  legalTemplates() {
    return this.settings.legalTemplates();
  }

  @Roles('ADMIN')
  @Patch('admin/settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto as never);
  }

  @Roles('ADMIN')
  @Post('admin/settings/hero-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadHeroImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BusinessRuleError('Envie uma imagem.');
    return this.settings.updateHeroImage(file);
  }

  @Roles('ADMIN')
  @Delete('admin/settings/hero-image')
  removeHeroImage() {
    return this.settings.removeHeroImage();
  }

  @Roles('ADMIN')
  @Get('admin/delivery-zones')
  listZones() {
    return this.zones.list();
  }

  @Roles('ADMIN')
  @Post('admin/delivery-zones')
  createZone(@Body() dto: ZoneDto) {
    return this.zones.save(dto);
  }

  @Roles('ADMIN')
  @Put('admin/delivery-zones/:id')
  updateZone(@Param('id') id: string, @Body() dto: ZoneDto) {
    return this.zones.save({ ...dto, id });
  }

  @Roles('ADMIN')
  @Delete('admin/delivery-zones/:id')
  removeZone(@Param('id') id: string) {
    return this.zones.remove(id);
  }
}
