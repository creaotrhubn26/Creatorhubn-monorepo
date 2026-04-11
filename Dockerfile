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

COPY backend/package*.json ./
RUN npm ci --include=dev

COPY backend ./
RUN npm run build

EXPOSE 10000 3003

CMD ["npm", "start"]
