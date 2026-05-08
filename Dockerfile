FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN corepack pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN corepack pnpm --filter @server-panel/server prisma generate
RUN corepack pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/server apps/server
COPY --from=build /app/apps/web/dist apps/web/dist
EXPOSE 3100
CMD ["corepack", "pnpm", "--filter", "@server-panel/server", "start"]
