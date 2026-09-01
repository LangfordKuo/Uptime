FROM node:22-slim

WORKDIR /app

# better-sqlite3 需要 python3 和构建工具（有预编译包时可直接下载）
RUN apt-get update -y && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000
ENV UPTIME_DB_PATH=/app/database/uptime.db

VOLUME ["/app/database", "/app/backups"]

EXPOSE 3000

CMD ["node", "src/app.js"]
