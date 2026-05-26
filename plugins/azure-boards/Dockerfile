FROM node:22-alpine AS build

WORKDIR /app/scripts
COPY scripts/package*.json ./
RUN npm ci
COPY scripts/ ./
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV AZURE_BOARDS_MCP_HOST=0.0.0.0
ENV AZURE_BOARDS_MCP_PORT=3000

WORKDIR /app/scripts
COPY --from=build /app/scripts/package*.json ./
COPY --from=build /app/scripts/dist ./dist

EXPOSE 3000
CMD ["node", "dist/hostedServer.js"]
