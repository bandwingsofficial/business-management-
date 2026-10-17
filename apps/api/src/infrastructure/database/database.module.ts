import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { DatabaseSettings } from '@/configs/app-config';

import { requireDatabaseUrl } from './database-url';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PrismaService => {
        const database = config.getOrThrow<DatabaseSettings>('database');
        return new PrismaService({ ...database, url: requireDatabaseUrl(database.url) });
      },
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
