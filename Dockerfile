FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV NG_CLI_ANALYTICS=false
ENV CI=true
# AG Grid + Angular 21: build de produção precisa de mais heap.
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx ng build --configuration=production --verbose=false

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/GTS-FrontEnd/browser /usr/share/nginx/html

EXPOSE 80
