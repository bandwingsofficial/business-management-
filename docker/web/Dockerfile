FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tooling/eslint/package.json tooling/eslint/package.json
COPY tooling/typescript/package.json tooling/typescript/package.json
COPY tooling/scripts/package.json tooling/scripts/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @softtech/web build \
  && pnpm --filter @softtech/web deploy --prod --legacy /out

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -g 10001 -S softtech \
  && adduser -S -D -H -u 10001 -G softtech softtech
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=softtech:softtech /out /app
USER softtech
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--port", "3000", "--hostname", "0.0.0.0"]
