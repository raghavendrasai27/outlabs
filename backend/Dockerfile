FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate && npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && npm start"]
