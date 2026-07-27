FROM oven/bun:1.2.19-slim AS base

WORKDIR /app

FROM base AS deps

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS builder

COPY . .

# Some modules validate env presence during build, but runtime values still come
# from the container environment.
RUN DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/logbook \
    AUTH_SECRET=build-placeholder-not-used-at-runtime \
    AUTH_URL=http://localhost:3000 \
    HELM_API_URL=https://helm.example.com \
    KEYCLOAK_CLIENT_ID=logbook \
    KEYCLOAK_CLIENT_SECRET=build-placeholder \
    KEYCLOAK_ISSUER=https://keycloak.example.com/realms/build \
    NEXT_TELEMETRY_DISABLED=1 \
    bun run build

FROM deps AS migrator

COPY . .
CMD ["bun", "run", "db:migrate"]

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]

