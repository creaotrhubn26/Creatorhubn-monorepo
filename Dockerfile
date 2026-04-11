FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    RENDER=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PHOTO_ENHANCER_BIN_DIR=/usr/bin

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    darktable \
    ffmpeg \
    g++ \
    git \
    imagemagick \
    libcairo2-dev \
    libgif-dev \
    libjpeg-dev \
    libimage-exiftool-perl \
    libpango1.0-dev \
    libraw-bin \
    librsvg2-dev \
    make \
    pkg-config \
    postgresql-client \
    python3 \
    rawtherapee \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/package*.json backend/.npmrc ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && for attempt in 1 2 3; do \
    npm ci --include=dev --legacy-peer-deps && break; \
    if [ "$attempt" = "3" ]; then exit 1; fi; \
    sleep $((attempt * 15)); \
  done

COPY frontend /app/frontend
COPY backend ./
RUN npm run build

EXPOSE 10000 3003

CMD ["npm", "start"]
