# Build context HARUS root repo (bukan folder server/) karena server/src/engine/signalEngine.ts
# import langsung dari ../../../src/lib/signals & futuresEngine — bukan reimplementasi.
# Build: docker build -f server/Dockerfile -t hellnah-trading-server .   (dijalankan dari root repo)
FROM oven/bun:1 AS base
WORKDIR /app

COPY server/package.json server/bun.lock* ./server/
RUN cd server && bun install --production

COPY src/lib ./src/lib
COPY src/types ./src/types
COPY server ./server

WORKDIR /app/server
EXPOSE 3010
CMD ["bun", "run", "src/index.ts"]
