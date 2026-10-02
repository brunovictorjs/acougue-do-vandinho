import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsString, Length } from 'class-validator';
import { Roles } from '../../../shared/presentation/auth.js';
import { AttendantsService } from '../application/attendants.service.js';

class AttendantDto {
  @IsString() @Length(3, 100) fullName!: string;
  @IsString() @Length(10, 20) phone!: string;
  @IsBoolean() active!: boolean;
}

class ReorderDto {
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) ids!: string[];
}

@Roles('ADMIN')
@Controller('admin/attendants')
export class AttendantsController {
  constructor(private readonly attendants: AttendantsService) {}

  @Get()
  list() {
    return this.attendants.list();
  }

  @Post()
  create(@Body() dto: AttendantDto) {
    return this.attendants.create(dto);
  }

  @Put('order')
  reorder(@Body() dto: ReorderDto) {
    return this.attendants.reorder(dto.ids);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: AttendantDto) {
    return this.attendants.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendants.remove(id);
  }
}
