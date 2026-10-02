import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../shared/presentation/auth.js';
import type { AuthUser } from '../../../shared/presentation/auth.js';
import { UserDirectory } from '../application/user-directory.js';
import { ChangeRoleDto, ListUsersQuery } from './dto.js';

@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UserDirectory) {}

  @Get()
  list(@Query() q: ListUsersQuery) {
    return this.users.list(q);
  }

  @Patch(':id/role')
  changeRole(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.users.changeRole(actor.id, id, dto.role);
  }
}
