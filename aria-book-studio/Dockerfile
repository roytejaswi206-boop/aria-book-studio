FROM node:24-alpine AS base

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]

