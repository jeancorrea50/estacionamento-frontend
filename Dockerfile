FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV NG_CLI_ANALYTICS=false
ENV CI=true
ENV NODE_OPTIONS=--max-old-space-size=2048

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration=production

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/GTS-FrontEnd/browser /usr/share/nginx/html

EXPOSE 80
