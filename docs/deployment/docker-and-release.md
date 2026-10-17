# Docker and release

Images are built from the repository root. They do not embed `.env` files. `.dockerignore` excludes environment files, dependencies, and build output. The Dockerfiles install from the lockfile during the image build.

```bash
docker build -f docker/api/Dockerfile -t softtech-api:local .
docker build -f docker/web/Dockerfile -t softtech-web:local .
```

The runtime stage runs as user `softtech` with uid 10001. The API process is `node dist/main.js` inside the deployed package, which is PID 1 and receives `SIGTERM`. `enableShutdownHooks()` closes the Nest application, and the database and Redis clients disconnect when they were started. The API health check calls `GET /api/v1/health`. The web health check calls `/`. A failing process exits non-zero. The health check does not mask a crash.

There is no worker image because there is no worker process.

Each runtime stage copies the result of `pnpm deploy --prod --legacy` for that package. The legacy flag is required on pnpm 10 because these packages do not inject workspace dependencies. Production dependencies are registry packages. That directory contains the built output and production dependencies. It does not copy the workspace `node_modules` tree used to compile the package. Confirm a built image does not contain `tsc-alias`, `vitest`, or `eslint` before treating the prune as verified. Local image builds are reported in the readiness notes for the machine that ran them.

## Configuration at run time

Pass environment variables when the container starts. Do not bake `DATABASE_URL`, `REDIS_URL`, tokens, or DSNs into the image. Production must set `NODE_ENV=production` and `API_PORT`. Leave optional providers unset until their credentials exist. See `docs/operations/environment-configuration.md`.

## Release

CI builds the images and does not push them and does not deploy them. A release is a manual decision after the CI jobs are green. This repository has no production deployment workflow.

Suggested order for a future release:

1. Review the migration SQL.
2. Confirm CI integration tests passed against the isolated database.
3. Take a backup of the target database. This repository does not take that backup.
4. Run `pnpm --filter @softtech/api exec prisma migrate deploy` with `DATABASE_URL` pointed at the target.
5. Start the new API image.
6. Check `GET /api/v1/health` and `GET /api/v1/ready`.
7. If the migration was wrong, ship a forward fix or restore the backup. Do not expect `migrate reset` to be safe.

Local image builds were not executed on the machine that prepared this document because the Docker CLI was not installed there. The GitHub Actions `images` job is the configured build.
