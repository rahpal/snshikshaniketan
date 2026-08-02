# Multi-stage: build the Vite bundle, then serve it from nginx.
#
# The build MUST happen in this image, not on the host: Vite 7 requires Node
# ^20.19 || >=22.12 and the mini PC runs Node 18, so a host-side `npm run build`
# fails outright. Keeping the toolchain in the builder stage also means the
# published image carries only static assets — no node_modules, no npm.

FROM node:22-alpine AS build
WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
