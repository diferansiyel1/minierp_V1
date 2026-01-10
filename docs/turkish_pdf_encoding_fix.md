# ReportLab Türkçe Karakter Sorunu ve Çözümü

## Problem

ReportLab ile oluşturulan PDF'lerde Türkçe karakterler (İ, Ş, Ö, Ü, Ğ, Ç, ı) kutu (□) olarak görünüyordu.

![Sorunlu PDF](uploaded_image_1768041778526.png)

**Etkilenen Karakterler:**
- `TEKLİF` → `TEKL□F`
- `MÜŞTERİ BİLGİLERİ` → `MÜ□TER□ B□LG□LER□`
- `İskonto` → `□skonto`
- `Açıklama` → `A□□klama`

---

## Neden?

ReportLab'ın varsayılan fontları (Helvetica, Times-Roman) **sadece Latin-1 karakter setini** destekler. Türkçe'ye özgü Unicode karakterler bu fontta mevcut değildir.

| Karakter | Unicode | Latin-1'de Var mı? |
|----------|---------|-------------------|
| İ | U+0130 | ❌ Hayır |
| ı | U+0131 | ❌ Hayır |
| Ş | U+015E | ❌ Hayır |
| ş | U+015F | ❌ Hayır |
| Ğ | U+011E | ❌ Hayır |
| ğ | U+011F | ❌ Hayır |

---

## Çözüm

### 1. Türkçe Destekleyen TTF Font İndirme

**DejaVu Sans** fontu kullanıldı (açık kaynak, geniş Unicode desteği):

```bash
mkdir -p backend/fonts
cd backend/fonts
curl -L -o dejavu-fonts.zip \
  "https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip"
unzip -j dejavu-fonts.zip "*/DejaVuSans.ttf" "*/DejaVuSans-Bold.ttf"
rm dejavu-fonts.zip
```

> ⚠️ **Dikkat:** GitHub raw dosya linki (`raw.githubusercontent.com`) kullanmayın! Bu link HTML içerik döndürebilir ve font dosyası bozuk olur. Resmi **release ZIP** dosyasını kullanın.

### 2. Font Kayıt Fonksiyonu

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
FONT_REGISTERED = False

def register_fonts():
    """DejaVu Sans fontlarını Türkçe karakter desteği için kaydet"""
    global FONT_REGISTERED
    if FONT_REGISTERED:
        return
    
    try:
        dejavu_path = os.path.join(FONTS_DIR, 'DejaVuSans.ttf')
        dejavu_bold_path = os.path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf')
        
        if os.path.exists(dejavu_path):
            pdfmetrics.registerFont(TTFont('DejaVuSans', dejavu_path))
            if os.path.exists(dejavu_bold_path):
                pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', dejavu_bold_path))
            FONT_REGISTERED = True
    except Exception as e:
        print(f"Font registration warning: {e}")
```

### 3. Stillerde Font Kullanımı

```python
# PDF oluşturmadan önce fontları kaydet
register_fonts()

# Font adını belirle
font_name = 'DejaVuSans' if FONT_REGISTERED else 'Helvetica'
font_name_bold = 'DejaVuSans-Bold' if FONT_REGISTERED else 'Helvetica-Bold'

# ParagraphStyle'da kullan
title_style = ParagraphStyle(
    'CustomTitle',
    fontName=font_name_bold,  # ← Burada
    fontSize=24,
    textColor=colors.HexColor('#1e40af')
)

# TableStyle'da kullan
table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, -1), font_name),  # ← Burada
    ('FONTNAME', (0, 0), (-1, 0), font_name_bold),
    # ...
]))
```

---

## Yaygın Hatalar

### ❌ Hata 1: Yanlış Font Linki
```bash
# YANLIŞ - HTML içerik döndürür
curl -L -o DejaVuSans.ttf \
  "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf"
```

**Sonuç:** `TTFError: Not a recognized TrueType font`

### ✅ Doğru: Release ZIP'ten İndirme
```bash
# DOĞRU - Gerçek TTF dosyası
curl -L -o dejavu.zip \
  "https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip"
```

### ❌ Hata 2: Font Kaydetmeden Kullanma
```python
# YANLIŞ - Font kayıtlı değilse hata verir
style = ParagraphStyle('Test', fontName='DejaVuSans')
```

### ✅ Doğru: Önce Kaydet, Sonra Kullan
```python
pdfmetrics.registerFont(TTFont('DejaVuSans', 'path/to/DejaVuSans.ttf'))
style = ParagraphStyle('Test', fontName='DejaVuSans')
```

---

## Alternatif Fontlar

DejaVu Sans dışında kullanılabilecek Türkçe destekli fontlar:

| Font | Platform | Lisans |
|------|----------|--------|
| DejaVu Sans | Cross-platform | Public Domain |
| Noto Sans | Cross-platform | OFL |
| Liberation Sans | Cross-platform | OFL |
| Arial Unicode MS | macOS/Windows | Proprietary |
| FreeSans | Linux | GPL |

---

## Test Komutu

```python
python3 -c "
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from io import BytesIO

# Font kaydet
pdfmetrics.registerFont(TTFont('DejaVuSans', 'backend/fonts/DejaVuSans.ttf'))

# PDF oluştur
buffer = BytesIO()
doc = SimpleDocTemplate(buffer, pagesize=A4)
style = ParagraphStyle('Test', fontName='DejaVuSans', fontSize=14)
elements = [Paragraph('TEKLİF - MÜŞTERİ - İskonto - Şirket - Ürünler', style)]
doc.build(elements)

# Kaydet ve aç
with open('/tmp/turkish_test.pdf', 'wb') as f:
    f.write(buffer.getvalue())
print('PDF oluşturuldu: /tmp/turkish_test.pdf')
"
```

---

## Sonuç

✅ Türkçe karakterler (İ, Ş, Ö, Ü, Ğ, Ç, ı) artık PDF'lerde doğru görünüyor.

**Anahtar Noktalar:**
1. TTF font dosyasını **doğru kaynaktan** indirin
2. `pdfmetrics.registerFont()` ile kaydedin
3. Tüm `ParagraphStyle` ve `TableStyle`'larda `fontName` belirtin
