import { Module } from '@nestjs/common';
import { AttendantsService } from './application/attendants.service.js';
import { AttendantsController } from './presentation/attendants.controller.js';

@Module({
  controllers: [AttendantsController],
  providers: [AttendantsService],
  exports: [AttendantsService],
})
export class SupportModule {}
