# Production imajı: derlenmiş Next.js (next build + next start).
# Geliştirme için docker-compose.dev.yml kullanılır (bind-mount + next dev --turbopack).
FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Bağımlılıklar (lockfile ile tekrarlanabilir kurulum; devDeps build için gerekli)
COPY package.json package-lock.json ./
RUN npm ci

# Kaynak → Prisma Client üret → production build
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Başlangıçta şemayı DB'ye uygula, sonra production sunucusunu başlat.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
