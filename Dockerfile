FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production NODE_NO_WARNINGS=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server ./server
COPY game-core ./game-core
COPY public ./public

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server/server.js"]
