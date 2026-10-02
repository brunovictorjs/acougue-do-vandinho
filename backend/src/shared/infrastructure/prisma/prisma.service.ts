import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { AppConfig } from '../../../config/app-config.js';

/**
 * Single Prisma client for the process. SQLite today; for Supabase swap the
 * adapter for `@prisma/adapter-pg` (PrismaPg) and the schema provider.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfig) {
    super({ adapter: new PrismaBetterSqlite3({ url: config.databaseUrl }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Atomic counter used for human-friendly codes such as VND-1042. */
  async nextSequence(name: string, start: number): Promise<number> {
    return this.$transaction(async (tx) => {
      const current = await tx.sequence.findUnique({ where: { name } });
      const value = current ? current.value + 1 : start;
      await tx.sequence.upsert({ where: { name }, create: { name, value }, update: { value } });
      return value;
    });
  }
}
