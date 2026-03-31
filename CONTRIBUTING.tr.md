[English](CONTRIBUTING.md) | **Türkçe**

# ghsecret'a Katkı Sağlamak

Katkı sağlamak istediğiniz için teşekkürler! Başlangıç için gerekli adımlar aşağıda.

## Geliştirme Ortamı

```bash
git clone https://github.com/barisdemirhan/ghsecret.git
cd ghsecret
npm install
npm run build
npm link  # test için `ghsecret` komutunu global olarak kullanılabilir kılar
```

## İş Akışı

1. Repo'yu fork'layın ve `main`'den bir branch oluşturun
2. Değişikliklerinizi `src/` içinde yapın
3. Yeni işlevler için `src/__tests__/` dizinine testler ekleyin
4. Kontrolleri çalıştırın:
   ```bash
   npm run lint    # tip kontrolü
   npm test        # testleri çalıştır
   npm run build   # derle
   ```
5. Manuel test edin: `ghsecret --help`, `ghsecret -s -a --dry-run` vb.
6. `main`'e karşı bir PR açın

## Proje Yapısı

```
src/
├── cli.tsx              # Giriş noktası, argüman ayrıştırma
├── app.tsx              # Ana uygulama bileşeni, akış kontrolü
├── components/
│   ├── Confirm.tsx      # e/H onay istemi
│   ├── ErrorMessage.tsx # Hata gösterimi (çıkış kodu 1)
│   ├── Help.tsx         # Yardım metni çıktısı
│   ├── Interactive.tsx  # İnteraktif mod (dosya, hedef, key, mod)
│   ├── MixedPicker.tsx  # Key başına secret/variable/atla seçici
│   └── Push.tsx         # Push işlemleri, çakışma/öncelik kontrolleri
├── utils/
│   ├── env-parser.ts    # .env dosya ayrıştırıcı
│   ├── gh.ts            # GitHub CLI sarmalayıcı fonksiyonlar
│   └── types.ts         # Paylaşılan tipler ve varsayılanlar
└── __tests__/
    └── env-parser.test.ts
```

## Kurallar

- **TypeScript strict mode** — `any` yok, `@ts-ignore` yok
- **React + Ink** tüm terminal arayüzü için — `Help.tsx` dışında ham `console.log` yok
- **`execFileSync`** tüm `gh` CLI çağrıları için — `execSync` ile string birleştirme asla kullanılmaz (shell injection riski)
- **Çıkış kodları** — hatalar `exit(new Error(...))` ile çıkış kodu 1 döndürmeli
- **Testler** — parser değişiklikleri için test ekleyin, uç durumları test edin

## Hata Bildirimi

[Hata raporu şablonunu](https://github.com/barisdemirhan/ghsecret/issues/new?template=bug_report.yml) kullanın. Log'lardaki secret'ları her zaman gizleyin.

## Özellik İstekleri

[Özellik isteği şablonunu](https://github.com/barisdemirhan/ghsecret/issues/new?template=feature_request.yml) kullanın. Çözüm önermeden önce problemi açıklayın.
