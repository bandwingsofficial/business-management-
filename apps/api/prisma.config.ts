import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration. Runtime configuration is validated in src/configs.
 * `prisma/generate.mjs` supplies a local placeholder when DATABASE_URL is absent
 * so client generation does not require a database. Migrate commands do not use that placeholder.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
