FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./package.json
COPY apps/server ./apps/server
COPY apps/mobile-web ./apps/mobile-web

EXPOSE 4899
CMD ["node", "apps/server/src/index.js"]
