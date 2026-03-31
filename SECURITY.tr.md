[English](SECURITY.md) | **Türkçe**

# Güvenlik Politikası

## Güvenlik Açığı Bildirimi

ghsecret'ta bir güvenlik açığı keşfederseniz, **lütfen public bir issue açmayın**.

Bunun yerine özel olarak bildirin:

1. [Security Advisories](https://github.com/barisdemirhan/ghsecret/security/advisories/new) sayfasına gidin
2. Veya doğrudan proje sorumlusuyla iletişime geçin

Lütfen şu bilgileri ekleyin:

- Güvenlik açığının tanımı
- Yeniden üretme adımları
- Potansiyel etki
- Önerilen düzeltme (varsa)

48 saat içinde yanıt alacaksınız. Herhangi bir kamuya açıklama öncesinde sorunu anlamak ve çözümlemek için sizinle birlikte çalışacağız.

## Güvenlik Mimarisi

ghsecret hassas verilerle (secret, API key, token) çalışır. Aşağıdaki önlemler alınmıştır:

### Shell Injection Korunması

Tüm `gh` CLI çağrıları argüman dizileriyle `execFileSync("gh", argsArray)` kullanır — `execSync` ile string birleştirme asla kullanılmaz. Bu, `.env` değerlerindeki shell metakarakterlerinin yorumlanmasını önler.

### İşlem Argümanı Sızıntısı Korunması

Secret değerleri `gh secret set`'e **stdin** (`input` seçeneği) üzerinden aktarılır, `--body` CLI argümanı olarak değil. Bu, değerlerin `ps aux`, `/proc/<pid>/cmdline` veya sistem denetim günlüklerinde görünmesini önler.

### Argüman Injection Savunması

- Key isimleri `^[A-Za-z_][A-Za-z0-9_]*$` regex'ine göre doğrulanır (GitHub Actions isimlendirme kuralları)
- Key argümanından önce POSIX `--` nöbetçisi yerleştirilir, `--repo=evil/repo` gibi key'lerin flag olarak yorumlanmasını önler

### Değer Maskeleme

- İnteraktif mod, key seçimi sırasında değerler yerine `••••••••` gösterir — mod (secret vs variable) o noktada henüz seçilmemiştir
- Mixed picker yalnızca key isimlerini gösterir, değerleri asla
- Dry-run modu secret değerlerini `********` olarak maskeler

### Tedarik Zinciri

- GitHub Actions, değiştirilebilir tag'ler yerine commit SHA'larına sabitlenmiştir
- npm release'leri `--provenance` onayı içerir (SLSA Build Level 2)
- `package.json` `files` alanı, test dosyalarını ve kaynak kodunu yayınlanan paketten hariç tutar

### Bilinen Kısıtlamalar

- **Bellek:** Secret değerler düz JavaScript string'leri olarak tutulur. V8, açık bellek sıfırlama desteklemez — değerler garbage collection'a kadar bellekte kalır. Bu, Node.js'in temel bir kısıtlamasıdır ve kullanıcı tarafında hafifletilemez.
- **Terminal scrollback:** Maskelemeye rağmen, herhangi bir terminal çıktısı (push sonuçları, hatalar) terminalin scrollback buffer'ında, ekran kayıtlarında veya tmux/screen günlüklerinde kalabilir.
- **Dosya yolu:** `--file` flag'i herhangi bir yolu kabul eder. ghsecret, dosya okumalarını geçerli dizinle sınırlandırmaz — bir kullanıcı (veya script) `~/.aws/credentials` gibi hassas dosyalara yönlendirebilir.

## Kapsam

Bu politika `ghsecret` CLI aracına uygulanır. Bağımlılıklardaki güvenlik açıkları ilgili projelere bildirilmelidir.

## Desteklenen Versiyonlar

| Versiyon | Destekleniyor |
|----------|---------------|
| En son   | Evet          |
| < En son | Hayır         |
