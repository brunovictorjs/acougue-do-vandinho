import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';
import { DomainEventPublisher } from './infrastructure/events/domain-event-publisher.js';
import { FileStorage } from './infrastructure/storage/file-storage.js';
import { LocalFileStorage } from './infrastructure/storage/local-file-storage.js';

@Global()
@Module({
  providers: [
    AppConfig,
    PrismaService,
    DomainEventPublisher,
    { provide: FileStorage, useClass: LocalFileStorage },
  ],
  exports: [AppConfig, PrismaService, DomainEventPublisher, FileStorage],
})
export class SharedModule {}
