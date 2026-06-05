# ButikYazma Monorepo

- `frontend` — Kullanici vitrin (`localhost:3000`)
- `admin` — Admin paneli (`localhost:3001`)
- `backend` — Node.js + Express API (`localhost:4000`)

## Gereksinimler

- Node.js 20+
- PostgreSQL

## Local kurulum

1. Bagimliliklari yukleyin:

```bash
npm install
```

2. Ortam dosyalarini olusturun:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp admin/.env.example admin/.env
```

3. `backend/.env` degerlerini doldurun:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/butikyazma
JWT_SECRET=super-secret-key
UPLOAD_DIR=backend/uploads
ADMIN_USERNAME=ArdaG
ADMIN_PASSWORD=fitcheck
```

4. `frontend/.env` ve `admin/.env`:

```env
VITE_API_URL=http://localhost:4000
```

5. Migration ve seed:

```bash
npm run migrate
npm run seed
```

6. Gelistirme sunuculari:

```bash
npm run dev
```

## Ortam degiskenleri

### backend/.env

| Degisken | Aciklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL baglanti URL'i |
| `JWT_SECRET` | Admin JWT imza anahtari |
| `UPLOAD_DIR` | Yuklenen gorsellerin dizini (local: `backend/uploads`) |
| `ADMIN_USERNAME` | Seed ile olusturulan admin kullanici adi |
| `ADMIN_PASSWORD` | Seed ile olusturulan admin sifresi |

Opsiyonel: `PORT` (varsayilan 4000), `CORS_ORIGINS`, `JWT_EXPIRES_IN`

### frontend/.env ve admin/.env

| Degisken | Aciklama |
|----------|----------|
| `VITE_API_URL` | Backend API adresi |

## Veritabani

- Migration: `backend/migrations/*.sql`
- Migration calistir: `npm run migrate`
- Seed (ornek veri): `npm run seed`

## Railway deployment

Proje 3 ayri Railway servisi olarak deploy edilir: **backend**, **frontend**, **admin**.

### 1. PostgreSQL

1. Railway'de yeni bir **PostgreSQL** servisi olusturun.
2. `DATABASE_URL` degiskeni otomatik olarak olusur.

### 2. Backend servisi

1. **New Service → GitHub Repo** ile projeyi baglayin.
2. **Root Directory**: `backend`
3. **Start Command**: `npm start`
4. Ortam degiskenleri:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<guclu-rastgele-deger>
UPLOAD_DIR=/app/uploads
ADMIN_USERNAME=<admin-kullanici-adi>
ADMIN_PASSWORD=<admin-sifresi>
CORS_ORIGINS=https://<frontend-domain>,https://<admin-domain>
```

5. **Volume** ekleyin ve `/app/uploads` yoluna mount edin (yuklenen gorseller kalici olsun).
6. Deploy sonrasi migration ve seed:

```bash
railway run npm run migrate
railway run npm run seed
```

7. Backend public URL'ini not alin (ornek: `https://butikyazma-api.up.railway.app`).

### 3. Frontend servisi

1. Yeni servis olusturun, **Root Directory**: `frontend`
2. **Build Command**: `npm install && npm run build`
3. **Start Command** (static site): `npx serve dist -s -l $PORT`
   - veya Railway **Static Site** kullanin, output: `dist`
4. Build-time ortam degiskeni:

```env
VITE_API_URL=https://<backend-railway-url>
```

### 4. Admin servisi

1. Yeni servis olusturun, **Root Directory**: `admin`
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npx serve dist -s -l $PORT`
4. Build-time ortam degiskeni:

```env
VITE_API_URL=https://<backend-railway-url>
```

### Production notlari

- `UPLOAD_DIR=/app/uploads` mutlaka volume ile kullanilmalidir; aksi halde redeploy'da gorseller silinir.
- `VITE_API_URL` build sirasinda set edilmelidir; deploy sonrasi degistirirseniz frontend/admin'i yeniden build edin.
- Backend CORS listesine frontend ve admin production URL'lerini ekleyin.
- Gorsel URL'leri frontend/admin tarafinda `VITE_API_URL` uzerinden normalize edilir; API `/uploads/...` relative path dondurur.

## Scripts

| Komut | Aciklama |
|-------|----------|
| `npm run dev` | Frontend, admin ve backend'i birlikte baslatir |
| `npm run migrate` | SQL migration dosyalarini calistirir |
| `npm run seed` | Migration + ornek veri yukler |
