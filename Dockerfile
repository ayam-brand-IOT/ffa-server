FROM node:16-bookworm

WORKDIR /app

# Saved exports are copied to a Windows share (services/smbCopy.js)
RUN apt-get update && apt-get install -y --no-install-recommends smbclient \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

COPY . /app

ENV PORT=3002
ENV DATABASE_PATH=/app/data/ffa-server.sqlite
ENV UPLOADS_PATH=/app/muestras
ENV EXPORTS_PATH=/app/exports

RUN mkdir -p /app/data /app/muestras /app/exports

EXPOSE 3002

VOLUME ["/app/data", "/app/muestras", "/app/exports"]

CMD ["npm", "start"]
