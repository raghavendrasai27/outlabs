FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate && npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && npm start"]
