FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock .
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock .
RUN bun install --production --frozen-lockfile --ignore-scripts
COPY --from=build /app/build ./build

USER bun
EXPOSE 3000

CMD ["bun", "build/index.js"]
