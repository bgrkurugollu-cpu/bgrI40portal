# i40portal — Mac Mini M4'e (7/24) Taşıma Rehberi

Bu doküman, uygulamayı şu an test için ayakta olduğu bu Mac'ten, sürekli (7/24) çalışacak Mac Mini M4'e taşımak için izlenecek adımları içerir. Hedef: aynı domain (`https://i40portal.bugrakurugollu.net`), aynı veri, kesintisiz devam.

## Mimari özeti (neyi taşıyoruz)

- **Docker Compose** (`db`, `app`, `llm` servisleri) — kod GitHub'da, veri iki Docker volume'ünde: `pgdata` (Postgres, ~10MB gerçek veri) ve `ollama_data` (gemma2:2b modeli, ~1.6GB — bunu taşımaya gerek yok, yeni makinede yeniden indirilir).
- **`cloudflared`** — Docker'ın DIŞINDA, macOS'ta native launchd servisi olarak çalışıyor. Domain'e giden trafiği bu servis taşıyor, taşınması gereken kritik parça bu.
- **`.env`** — `JWT_SECRET` içeriyor, repoda değil (`.gitignore`), manuel taşınmalı.

## 1. Mac Mini M4'te ön hazırlık

- **Docker Desktop** kur (Apple Silicon/arm64 sürümü — M4 de arm64 olduğu için ek bir uyumluluk sorunu yok).
- **Git** kur (Xcode Command Line Tools ile gelir: `xcode-select --install`).
- Mac Mini'nin **uyumaması** için: Sistem Ayarları → Enerji Tasarrufu → "Ekran kapandığında bilgisayarı uykuya alma" kapalı olmalı (sunucu gibi çalışacağı için).
- **Docker Desktop'ın giriş yapınca otomatik başlaması**: Docker Desktop → Settings → General → "Start Docker Desktop when you log in" işaretli olmalı. Bu, Mac Mini'de **otomatik giriş (auto-login)** açık olmasını da gerektirir (aksi halde reboot sonrası biri fiziksel/uzaktan giriş yapmadan Docker başlamaz) — Sistem Ayarları → Kullanıcılar → Otomatik giriş.

## 2. Repo'yu klonla

```bash
git clone https://github.com/bgrkurugollu-cpu/bgrI40portal.git i40portal
cd i40portal
```

## 3. Secret'ı taşı (`.env`)

Bu dosya repoda yok, elle taşınmalı. **Sohbete/chat'e yapıştırma** — AirDrop, şifreli not uygulaması veya `scp` ile taşı:

```bash
# Bu makinede (eski Mac):
scp .env kullanici@mac-mini-ip:~/i40portal/.env
```

veya AirDrop ile dosyayı doğrudan gönder.

## 4. Veritabanını taşı

DB küçük (~10MB), en basit yol `pg_dump` / `psql`:

```bash
# Eski Mac'te: dump al
docker exec bgr-brain-db pg_dump -U bgr -d bgrbrain > i40portal_dump.sql

# Dump dosyasını Mac Mini'ye taşı (scp/AirDrop)
scp i40portal_dump.sql kullanici@mac-mini-ip:~/i40portal/

# Mac Mini'de: önce servisleri ayağa kaldır (aşağıdaki adım 5), db healthy olduktan sonra:
cat i40portal_dump.sql | docker exec -i bgr-brain-db psql -U bgr -d bgrbrain
```

## 5. Mac Mini'de servisleri ayağa kaldır

```bash
docker compose up -d --build
docker compose ps   # db/app/llm healthy olmalı
```

Ollama modeli `llm` servisinin `entrypoint`'i sayesinde otomatik `gemma2:2b`'yi indirecek (ilk açılışta birkaç dakika sürebilir, `docker logs bgr-brain-llm -f` ile izlenebilir).

DB dump'ını adım 4'teki gibi bu noktada içeri aktar.

## 6. `cloudflared`'ı Mac Mini'de kur

Aynı tunnel token kullanılacak — Cloudflare tarafında **hiçbir dashboard değişikliği gerekmez**, token hesaba/tünele bağlı, makineye değil.

```bash
curl -sL -o cloudflared.tgz "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
tar xzf cloudflared.tgz
sudo cp cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
sudo cloudflared service install <AYNI_TUNNEL_TOKEN>
```

Token'ı bilmiyorsan Cloudflare Zero Trust → Networks → Tunnels → `i40portal` tünelinin connector kurulum ekranından tekrar görüntülenebilir (token'ı yeniden üretmeye gerek yok).

## 7. Eski Mac'te `cloudflared`'ı durdur

**Aynı tunnel token'ı iki makinede aynı anda çalıştırma** — Cloudflare, aynı tünelin birden fazla connector'ı arasında trafiği dağıtır (round-robin), bu da iki farklı makinede iki farklı (senkron olmayan) veritabanına rastgele istek gitmesi anlamına gelir. Mac Mini'de her şey doğrulandıktan SONRA eski Mac'te servisi durdur:

```bash
sudo launchctl bootout system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
```

İstersen eski Mac'teki `docker compose down` ile konteynerleri de durdurabilirsin (volume'ler kalır, veri kaybolmaz).

## 8. Doğrulama

1. `ps aux | grep cloudflared` — Mac Mini'de çalıştığını doğrula.
2. `https://i40portal.bugrakurugollu.net/login` — dışarıdan eriş, giriş yap.
3. Fatura/proje listesinin eski Mac'teki veriyle aynı olduğunu kontrol et (dump doğru aktarıldıysa).
4. Bir form gönder (örn. fatura ekleme) — `next.config.mjs`'deki `allowedOrigins` sorunsuz çalışmalı (domain aynı kaldığı için ek değişiklik gerekmiyor).
5. Mac Mini'yi yeniden başlat (`sudo reboot`), birkaç dakika bekle, `https://i40portal.bugrakurugollu.net` hâlâ açılıyor mu kontrol et — bu, "otomatik giriş + Docker Desktop otomatik başlatma" zincirinin gerçekten çalıştığını kanıtlar.

## Notlar

- `cloudflared` (launchd `LaunchDaemon`) root olarak, kullanıcı girişi olmadan boot'ta otomatik başlar — bu kısım için auto-login gerekmez. Auto-login gerekliliği sadece **Docker Desktop**'tan kaynaklanıyor (kullanıcı oturumu bekleyen bir uygulama). Eğer auto-login güvenlik açısından istenmiyorsa, alternatif: Docker Desktop yerine **Colima** veya **OrbStack** gibi arka planda (login-independent) çalışabilen bir Docker runtime'a geçmek — bu, ayrı bir değerlendirme gerektirir.
- DB şifresi (`bgrsecret`) taşıma sırasında da değişmiyor — [[cloudflare-tunnel-setup]] memory notunda belirtildiği gibi bu ayrı bir opsiyonel iyileştirme.
