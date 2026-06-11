# ---- build/runtime image for the API ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --omit=dev --no-package-lock
COPY src ./src
COPY migrations ./migrations
EXPOSE 4000
# Drop privileges
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4000/healthz || exit 1
CMD ["node", "src/server.js"]
