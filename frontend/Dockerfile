# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Paket bağımlılıklarını kopyala ve yükle
COPY package.json package-lock.json ./
RUN npm ci

# Kaynak kodları kopyala
COPY . .

# API_URL build zamanında gömülebilir
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Run stage
FROM nginx:alpine

# Nginx konfigürasyonunu kopyala
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build aşamasından dosyaları kopyala
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
