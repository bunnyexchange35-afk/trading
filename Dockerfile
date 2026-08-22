FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_TELEGRAM_URL=https://t.me/mudrexxearn_support
ENV VITE_TELEGRAM_URL=$VITE_TELEGRAM_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html postcss.config.js ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["npm", "start"]
