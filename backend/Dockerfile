# Multi-stage production build for EcoTrack Full-Stack Platform
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/services/seedData.ts ./src/services/seedData.ts
COPY --from=builder /app/src/utils/ecoLogic.ts ./src/utils/ecoLogic.ts
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

RUN apk add --no-cache curl

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
