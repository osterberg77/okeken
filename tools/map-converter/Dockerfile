# Map converter (decision 0025). Build from the repo root:
#   docker build -f tools/map-converter/Dockerfile -t map-converter .
#
# panmap (AGPL-3.0, https://github.com/kiwirm/panmap) is fetched at a fixed commit and patched with
# tools/map-converter/panmap.patch; that patch and this file are the complete source of our modified version.

FROM node:22-bookworm-slim AS panmap
ARG PANMAP_COMMIT=33c51fef6a41d5999423f293ab8156eb73780f15
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
RUN git clone https://github.com/kiwirm/panmap && cd panmap && git checkout "$PANMAP_COMMIT"
COPY tools/map-converter/panmap.patch /opt/panmap.patch
WORKDIR /opt/panmap
RUN git apply /opt/panmap.patch && npm ci && npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY tools/map-converter/package.json tools/map-converter/package-lock.json ./
RUN npm ci --omit=dev

FROM ghcr.io/osgeo/gdal:ubuntu-small-3.12.1
RUN apt-get update \
  && apt-get install -y --no-install-recommends librsvg2-bin pngquant fonts-liberation fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=panmap /usr/local/bin/node /usr/local/bin/node
COPY --from=panmap /opt/panmap /opt/panmap
COPY --from=deps /app/node_modules /app/node_modules
COPY tools/map-converter/package.json tools/map-converter/job.mjs /app/
COPY scripts/map-tiles.mjs /app/map-tiles.mjs
ENV PANMAP=/opt/panmap/dist/cli/main.js MAP_TILES_SCRIPT=/app/map-tiles.mjs NODE_ENV=production
WORKDIR /app
CMD ["node", "/app/job.mjs"]
