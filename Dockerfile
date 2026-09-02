FROM node:22-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm rebuild better-sqlite3
RUN npm run build

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/ledger.sqlite
ENV PORT=3000

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["npm", "start"]
