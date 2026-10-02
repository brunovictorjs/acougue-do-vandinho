import { Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessRuleError } from '../../../shared/domain/errors.js';
import { CurrentUser } from '../../../shared/presentation/auth.js';
import type { AuthUser } from '../../../shared/presentation/auth.js';
import { ProfileService } from '../application/profile.service.js';
import { ConfirmPhoneDto, RequestPhoneDto, UpdateProfileDto } from './dto.js';

@Controller('me')
export class MeController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.profile.me(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profile.updateName(user.id, dto.firstName, dto.lastName);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  avatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BusinessRuleError('Envie uma imagem.');
    return this.profile.updateAvatar(user.id, file);
  }

  @Post('phone')
  requestPhone(@CurrentUser() user: AuthUser, @Body() dto: RequestPhoneDto) {
    return this.profile.requestPhoneVerification(user.id, dto.phone);
  }

  @Post('phone/confirm')
  confirmPhone(@CurrentUser() user: AuthUser, @Body() dto: ConfirmPhoneDto) {
    return this.profile.confirmPhone(user.id, dto.code);
  }
}
