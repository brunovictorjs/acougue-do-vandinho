import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service.js';
import { ProfileService } from './application/profile.service.js';
import { UserDirectory } from './application/user-directory.js';
import { GoogleOAuthClient } from './infrastructure/google-oauth.client.js';
import { AdminUsersController } from './presentation/admin-users.controller.js';
import { AuthController } from './presentation/auth.controller.js';
import { MeController } from './presentation/me.controller.js';

@Module({
  controllers: [AuthController, MeController, AdminUsersController],
  providers: [AuthService, ProfileService, UserDirectory, GoogleOAuthClient],
  exports: [UserDirectory],
})
export class IdentityModule {}
