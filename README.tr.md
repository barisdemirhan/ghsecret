![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-D97757?logo=claude&logoColor=fff)

[English](README.md) | **Türkçe**

# ghsecret

`.env` değişkenlerini GitHub Secrets & Variables'a aktar — akıllı çakışma tespiti ve öncelik uyarılarıyla.

```bash
# Tüm .env değişkenlerini secret olarak aktar
ghsecret -s -a

# İnteraktif mod — dosya, hedef, key ve mod seç
ghsecret -i
```

## Neden

GitHub Secrets ve Variables'ı web arayüzünden yönetmek yavaş ve hataya açıktır. `ghsecret` `.env` dosyanızı okur ve değerleri doğrudan GitHub CLI üzerinden aktarır — yaygın hataları önleyen güvenlik kontrolleriyle:

- Üzerine yazmadan önce **mevcut değerleri tespit eder** ve onay ister
- **GitHub öncelik kurallarını** (Environment > Repository > Organization) kontrol eder, sessizce gölgelenen secret'lar için uyarır
- Yetki sorunları, rate limit ve ağ hataları için **anlaşılır hata mesajları**
- Hiçbir şeye dokunmadan önizleme için **dry run modu**

## Hızlı Başlangıç (kurulum gereksiz)

```bash
# İnteraktif mod — adım adım rehberli
npx ghsecret -i

# Tek bir key'i secret olarak aktar
npx ghsecret -s -k DB_PASSWORD

# Belirli bir dosyadan aktar
npx ghsecret -s -a -f .env.production

# Tüm key'leri variable olarak aktar (önce dry run)
npx ghsecret -v -a --dry-run

# Belirli bir environment'a aktar
npx ghsecret -s -k API_KEY --env staging

# Organization'a aktar
npx ghsecret -v -k SLACK_WEBHOOK --org my-org

# Belirli bir repo'ya aktar (remote seçimini atla)
npx ghsecret -s -a --repo my-org/my-repo
```

## Kurulum

```bash
# Sürekli kullanım için global kurulum
npm install -g ghsecret

# Veya klonlayıp bağla
git clone https://github.com/barisdemirhan/ghsecret.git
cd ghsecret && npm install && npm run build && npm link
```

**Gereksinimler:** `gh auth login` ile doğrulanmış [GitHub CLI (`gh`)](https://cli.github.com) ve Node.js 18+.

## Kullanım

```
ghsecret -s|-v [seçenekler]            Secret veya variable olarak aktar
ghsecret -i                            İnteraktif mod
ghsecret push <key1> <key2> ... -s     Belirli key'leri aktar
```

### Modlar

| Flag | Açıklama |
|------|----------|
| `-s, --secret` | GitHub Secret olarak aktar |
| `-v, --variable` | GitHub Variable olarak aktar |
| `-i, --interactive` | İnteraktif seçici (dosya, hedef, key ve mod seç) |

### Seçenekler

| Flag | Açıklama |
|------|----------|
| `-f, --file <yol>` | Env dosya yolu (varsayılan: `.env`) |
| `-a, --all` | Dosyadaki tüm key'leri aktar |
| `-k, --keys <k1,k2>` | Virgülle ayrılmış key listesi |
| `--org <isim>` | Organization seviyesine aktar |
| `--env <isim>` | Environment seviyesine aktar |
| `--dry-run` | Aktarmadan önizle |
| `--force` | Onay istemlerini atla |
| `--repo <owner/repo>` | Belirli bir repository'yi hedefle (remote seçimini atlar) |

## Örnekler

```bash
# Tüm değişkenleri secret olarak aktar
ghsecret -s -a

# Belirli key'leri variable olarak aktar
ghsecret -v -k APP_NAME,APP_URL,APP_ENV

# Belirli bir dosyadan dry run ile
ghsecret -s -a -f .env.production --dry-run

# Staging environment'ına aktar
ghsecret -s -k DB_HOST,DB_PASSWORD --env staging

# Organization'a aktar
ghsecret -v -k SLACK_WEBHOOK --org my-org

# CI/CD — onay yok
ghsecret -s -a --force

# Belirli bir repo'yu hedefle (birden fazla remote varsa kullanışlı)
ghsecret -s -a --repo my-org/my-repo
```

## İnteraktif Mod

Adım adım rehberli deneyim için `ghsecret -i` çalıştırın:

```
📁 Env file path:
  › .env.production

🎯 Push target:
 ❯ 📦 Repository
   🏢 Organization
   🌍 Environment

📋 Variables in .env.production:
─────────────────────────────────────────
 ❯ ◉  APP_NAME                      = ••••••••
   ◉  APP_ENV                       = ••••••••
   ○  DB_HOST                       = ••••••••
   ◉  DB_PASSWORD                   = ••••••••
   ○  REDIS_URL                     = ••••••••

 ↑↓ gezin · space seç · a tümünü seç · enter onayla · q çık
 3 seçili

Push as:
 ❯ 🔒 Secret
   📋 Variable
   🔀 Mixed (key başına seç)
```

## Remote Seçimi

Birden fazla git remote tespit edildiğinde ghsecret hangi repo'ya aktarılacağını sorar:

```
🔗 Birden fazla remote bulundu. Hangi repo'ya aktarılsın?
 ❯ origin   → barisdemirhan/ghsecret
   upstream → someorg/ghsecret
```

Seçimi atlamak için `--repo` kullanın:

```bash
ghsecret -s -a --repo someorg/ghsecret
```

## Push İlerlemesi

Her key tek tek aktarılır ve anlık geri bildirim verilir:

```
 ✓ APP_NAME → 🔒 secret
 ✓ DB_HOST → 📋 variable
 ✗ BAD_KEY — Permission denied
⠋ Aktarılıyor 4/15... API_KEY → 🔒 secret
```

## Güvenlik Özellikleri

### Çakışma Tespiti

Aktarmadan önce ghsecret, hedef seviyede key'lerin mevcut olup olmadığını kontrol eder:

```
⚠ 2 key zaten bu seviyede mevcut:
  • DB_PASSWORD (güncelleme: 15.03.2026)
  • API_KEY (güncelleme: 01.03.2026)
Mevcut değerlerin üzerine yazılsın mı? [y/N]
```

### Öncelik Uyarıları

GitHub, secret ve variable'ları bir öncelik sistemiyle çözer: **Environment > Repository > Organization**. ghsecret aktarımınızın etkisiz olacağı durumları tespit eder:

```
🚫 1 key daha yüksek öncelikli seviye tarafından gölgeleniyor:
  GitHub önceliği: Environment > Repository > Organization
  • DB_PASSWORD — Repository seviyesinde aynı key mevcut ve o kullanılacak
  Bu değerler çalışma zamanında KULLANILMAYACAK!
Bazı key'ler gölgelenecek. Yine de devam edilsin mi? [y/N]
```

Veya aktarımınız daha düşük öncelikli bir seviyeyi geçersiz kıldığında:

```
ℹ 1 key daha düşük öncelikli değerleri geçersiz kılacak:
  • DB_PASSWORD — Organization seviyesindeki değeri geçersiz kılacak
```

### Otomatik Environment Oluşturma

Henüz mevcut olmayan bir environment'a aktarım yaparken ghsecret oluşturmayı teklif eder:

```
⚠ Environment "staging" bu repository'de mevcut değil.
"staging" environment'ı oluşturulup devam edilsin mi? [y/N]
```

### Hata Yönetimi

Ham API hataları yerine anlaşılır, eyleme geçirilebilir mesajlar:

| Senaryo | Mesaj |
|---------|-------|
| Yetersiz yetki | `Permission denied. Check your token scopes and repo access.` |
| Repo/org bulunamadı | `Resource not found. Check the repo, org, or environment name.` |
| Rate limit | `Rate limited by GitHub API. Wait a moment and try again.` |
| Ağ sorunu | `Network error. Check your internet connection.` |

### Çıkış Kodları

| Kod | Anlam |
|-----|-------|
| `0` | Başarılı |
| `1` | Hata veya kullanıcı iptal etti |

`&&` zincirleme ve CI pipeline'larıyla uyumlu çalışır.

## .env Formatı

Multiline değerler dahil tüm yaygın formatları destekler:

```env
# Yorumlar atlanır
APP_NAME=MyApp
APP_URL="https://example.com"
APP_KEY='base64:abc123'
export DB_HOST=localhost
INLINE=value # satır içi yorumlar temizlenir

# Multiline değerler
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"
```

## Kaldırma

```bash
npm uninstall -g ghsecret
```

## Lisans

[MIT](LICENSE)
