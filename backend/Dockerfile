# Python 3.11 tabanlı imajı kullan
FROM python:3.11-slim

# Çalışma dizinini ayarla
WORKDIR /app

# Sistem bağımlılıklarını yükle
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları kopyala ve yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend paket dizinini oluştur
RUN mkdir -p /app/backend

# Uygulama kodunu backend paketine kopyala
COPY . /app/backend/

# __init__.py'nin var olduğundan emin ol (paket olarak tanınması için)
RUN touch /app/backend/__init__.py

# Data ve uploads dizinlerini oluştur
RUN mkdir -p /app/data /app/uploads

# Python path'i ayarla
ENV PYTHONPATH=/app

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Portu dışa aç
EXPOSE 8000

# Uygulamayı başlat
CMD ["/app/start.sh"]

