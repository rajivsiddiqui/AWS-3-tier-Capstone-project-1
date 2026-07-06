FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY package*.json ./
USER app
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "src/server.js"]
