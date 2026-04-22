FROM node:16-bullseye

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . /app

ENV PORT=3002
ENV DATABASE_PATH=/app/data/ffa-server.sqlite
ENV UPLOADS_PATH=/app/muestras

RUN mkdir -p /app/data /app/muestras

EXPOSE 3002

VOLUME ["/app/data", "/app/muestras"]

CMD ["npm", "start"]
