# Python 3.11 tabanlı imajı kullan
FROM python:3.11-slim

# Çalışma dizinini ayarla
WORKDIR /app

# Sistem bağımlılıklarını yükle (PostgreSQL ve PDF oluşturma için gerekli olabilir)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları kopyala ve yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodunu kopyala (paket yapısını korumak için backend klasörüne)
COPY . backend/

# Portu dışa aç
EXPOSE 8000

# Uygulamayı başlat
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
