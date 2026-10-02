import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PageQuery } from '../../../shared/application/pagination.js';
import type { RoleName } from '../../../shared/presentation/auth.js';

export const ROLES: RoleName[] = ['CUSTOMER', 'COURIER', 'EMPLOYEE', 'ADMIN'];

export class DevLoginDto {
  @IsIn(ROLES)
  role!: RoleName;
}

export class UpdateProfileDto {
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;
}

export class RequestPhoneDto {
  @IsString()
  @Length(10, 20)
  phone!: string;
}

export class ConfirmPhoneDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class ChangeRoleDto {
  @IsIn(ROLES)
  role!: RoleName;
}

export class ListUsersQuery extends PageQuery {
  @IsOptional()
  @IsIn(ROLES)
  role?: RoleName;

  @IsOptional()
  @IsString()
  search?: string;
}
