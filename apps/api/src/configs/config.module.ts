import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { loadEnv } from './load-env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [(): ReturnType<typeof loadEnv> => loadEnv()],
    }),
  ],
})
export class AppConfigModule {}
