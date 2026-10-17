FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
RUN apk add --no-cache openssl
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tooling/eslint/package.json tooling/eslint/package.json
COPY tooling/typescript/package.json tooling/typescript/package.json
COPY tooling/scripts/package.json tooling/scripts/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @softtech/api build \
  && pnpm --filter @softtech/api deploy --prod --legacy /out

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl \
  && addgroup -g 10001 -S softtech \
  && adduser -S -D -H -u 10001 -G softtech softtech
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3001
COPY --from=build --chown=softtech:softtech /out /app
USER softtech
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/api/v1/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
