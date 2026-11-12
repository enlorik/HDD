# HDD production image: Node (for the Express server + Vite build) plus
# a JDK and the Kotlin compiler, so /api/run/kotlin-samples can compile and
# run submitted Kotlin directly (see localKotlinRunner.js) instead of
# depending on a third-party execution API.
FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim

# OpenJDK 17 (the newest LTS available in Debian bookworm's default repos -
# 21 isn't packaged there) plus unzip/curl to fetch the official Kotlin
# compiler distribution. Kotlin 2.0.21 fully supports JDK 17.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jdk-headless curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV KOTLIN_VERSION=2.0.21
RUN curl -sL -o /tmp/kotlin-compiler.zip \
        "https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip" \
    && unzip -q /tmp/kotlin-compiler.zip -d /opt \
    && rm /tmp/kotlin-compiler.zip
ENV PATH="/opt/kotlinc/bin:${PATH}"

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server.js judge0.js localKotlinRunner.js outputNormalize.js kotlinLibrary.js cfStatementParser.js ./

# Run as a non-root user - this app has exactly one trusted operator, but
# there's no reason the Kotlin compile/run step needs root, so don't give
# it root.
RUN useradd --create-home --shell /bin/false hdd \
    && chown -R hdd:hdd /app
USER hdd

EXPOSE 3000
CMD ["node", "server.js"]
