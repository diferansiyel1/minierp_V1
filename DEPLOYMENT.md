# MiniERP - Coolify Deployment Rehberi

Bu rehber, MiniERP uygulamasının Coolify ile VDS sunucuya deploy edilmesini adım adım açıklamaktadır.

## Ön Gereksinimler

- [x] Coolify kurulu VDS sunucu
- [x] GitHub hesabı
- [x] Domain adı (örn: minierp.yourdomain.com)

---

## GitHub ile Deployment

### Adım 1: Projeyi GitHub'a Yükleyin

```bash
# Yeni repository oluştur (GitHub.com üzerinden) veya mevcut olanı kullan

# Local'deki projeyi GitHub'a push edin
cd /path/to/minierp
git init  # Eğer henüz git repo değilse
git add .
git commit -m "Initial commit for Coolify deployment"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/minierp.git
git push -u origin main
```

### Adım 2: Coolify'da GitHub Bağlantısı

1. **Coolify Dashboard** → **Sources** → **Add New Source**
2. **GitHub App** seçin
3. **Create GitHub App** butonuna tıklayın
4. GitHub hesabınıza yönlendirileceksiniz
5. Uygulamayı yetkilendirin ve repository'lere erişim verin

### Adım 3: Yeni Proje Oluşturun

1. **Projects** → **Add New Project**
2. Proje adı girin: `MiniERP`
3. **Add Resource** butonuna tıklayın

### Adım 4: Docker Compose Kaynağı Ekleyin

1. **Docker Compose** seçin
2. **GitHub** source'unu seçin
3. **minierp** repository'sini seçin
4. Branch: `main`
5. **Continue** tıklayın

### Adım 5: Build Ayarları

Docker Compose dosyası otomatik olarak algılanacaktır:

| Ayar | Değer |
|------|-------|
| Docker Compose Location | `./docker-compose.yml` |
| Base Directory | `/` (root) |


### 3. Environment Değişkenleri

Coolify'da **Environment Variables** bölümüne aşağıdaki değişkenleri ekleyin:

```env
# Zorunlu
DATABASE_URL=sqlite:////app/data/minierp.db

# İsteğe Bağlı (güvenlik için değiştirin)
SECRET_KEY=your-super-secure-random-key-here

# Domain'iniz varsa ekleyin
CORS_ORIGINS=https://minierp.yourdomain.com,https://yourdomain.com

# Frontend API URL (varsayılan /api)
VITE_API_URL=/api
```

### 4. Domain Ayarları

1. **Domains** bölümüne gidin
2. Domain ekleyin: `minierp.yourdomain.com`
3. **Generate SSL Certificate** seçeneğini aktif edin (Let's Encrypt)

### 5. Deploy

1. **Deploy** butonuna tıklayın
2. Build loglarını takip edin
3. Deployment tamamlandığında domain'e erişin

## Gelişmiş Ayarlar

### Port Ayarları

Coolify varsayılan olarak 80/443 portlarını kullanır. Eğer farklı portlar kullanmak isterseniz:

- Frontend: Port 80 olarak ayarlı (nginx)
- Backend: Port 8000 (internal, nginx üzerinden proxy)

### Persistent Data (Kalıcı Veri)

Aşağıdaki volume'lar otomatik olarak oluşturulur:

| Volume | Kullanım |
|--------|----------|
| `minierp-data` | SQLite veritabanı (`/app/data`) |
| `./uploads` | Yüklenen dosyalar (`/app/uploads`) |

### Health Checks

Servisler aşağıdaki health check endpoint'lerini kullanır:

| Servis | Endpoint | Interval |
|--------|----------|----------|
| Backend | `http://localhost:8000/health` | 30s |
| Frontend | `http://localhost/health` | 30s |

## Sorun Giderme

### Container Başlamıyor

```bash
# Coolify üzerinden logs'a bakın veya SSH ile bağlanıp:
docker compose logs -f
```

### Database Hatası

```bash
# Volume'un doğru oluşturulduğunu kontrol edin
docker volume ls | grep minierp
```

### API'ye Erişilemiyor

1. Backend container'ın çalıştığını kontrol edin
2. Nginx proxy ayarlarını kontrol edin
3. CORS ayarlarını kontrol edin

### CORS Hatası

`CORS_ORIGINS` environment variable'ına domain'inizi eklediğinizden emin olun:

```env
CORS_ORIGINS=https://minierp.yourdomain.com
```

## Güncelleme / Rollback

### Otomatik Deployment (GitHub Push ile)

GitHub'a her push yaptığınızda otomatik deploy için:

1. Coolify'da projenizi açın
2. **Settings** → **Webhooks** bölümüne gidin
3. **Enable Auto Deploy** seçeneğini aktif edin
4. **Push** eventi için webhook otomatik olarak GitHub'a eklenir

Artık `main` branch'e her push yaptığınızda:
```bash
git add .
git commit -m "Yeni özellik"
git push origin main
# → Coolify otomatik olarak yeniden deploy eder! 🚀
```

### Manuel Deployment

1. Coolify dashboard'uma gidin
2. Projenizi seçin
3. **Deploy** butonuna tıklayın
4. Build loglarını takip edin

### Rollback (Geri Alma)

1. **Deployments** sekmesine gidin
2. Önceki başarılı deployment'ı seçin
3. **Rollback** butonuna tıklayın

## Backup Stratejisi

### Veritabanı Backup

```bash
# SSH ile sunucuya bağlanın
docker cp minierp-backend:/app/data/minierp.db ./backup-$(date +%Y%m%d).db
```

### Otomatik Backup (Coolify S3/Backup özelliği)

1. **Settings** → **Backup**
2. S3 veya diğer storage sağlayıcısını yapılandırın
3. Backup schedule ayarlayın

## Örnek Coolify Konfigürasyonu

```yaml
# Coolify otomatik olarak docker-compose.yml kullanır
# Ek ayarlar için coolify.yaml oluşturabilirsiniz (isteğe bağlı)

version: '1'
services:
  - name: frontend
    domain: minierp.yourdomain.com
    ssl: true
    
  - name: backend
    # Backend'e external erişim gerekiyorsa
    # domain: api.yourdomain.com
```

## Sonuç

Deployment tamamlandığında aşağıdaki URL'lere erişebilirsiniz:

- **Frontend**: `https://minierp.yourdomain.com`
- **API**: `https://minierp.yourdomain.com/api`
- **Health Check**: `https://minierp.yourdomain.com/api/health`

---

> **Not**: İlk deployment'ta veritabanı otomatik olarak oluşturulacaktır. Mevcut bir veritabanını migrate etmek isterseniz, container'a kopyalayabilirsiniz:
> ```bash
> docker cp local-minierp.db minierp-backend:/app/data/minierp.db
> ```
