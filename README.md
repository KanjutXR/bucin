# Kenangan Game Kita

Scrapbook kenangan buat kalian berdua. Sekarang cuma bisa dibuka lewat QR code,
dan hanya admin yang bisa menambah/mengedit/menghapus kenangan.

## Cara kerja akses

- **Buka lewat link biasa** → hanya muncul layar terkunci + tombol "Masuk sebagai admin".
- **Scan QR code** → langsung masuk ke buku kenangan sebagai *tamu* (bisa lihat & swipe,
  tidak bisa tambah/edit/hapus).
- **Login sebagai admin** (pakai `ADMIN_PASSWORD`) → bisa lihat semuanya + tambah, edit,
  hapus kenangan, ganti gambar "you + me", dan generate ulang QR code kapan pun mau.

Sesi disimpan lewat cookie aman (httpOnly) selama 30 hari untuk tamu dan 7 hari untuk admin.

## Deploy ke Vercel

1. Push folder ini ke GitHub (atau upload langsung), lalu import project-nya di Vercel.
2. Di **Storage** tab project → klik **Create Database → Blob**. **Penting: pilih access
   mode "Public"**, bukan "Private" (dashboard Vercel sekarang defaultnya Private). Store
   Private tidak bisa dipakai app ini karena butuh URL yang bisa langsung dibuka di
   `<img>`/`<video>` tanpa token. Setelah dibuat, connect store-nya ke project ini — Vercel
   otomatis menambahkan env var `BLOB_READ_WRITE_TOKEN`, tidak perlu diisi manual.
3. Di **Project → Settings → Environment Variables**, tambahkan juga:
   - `ACCESS_KEY` — kata rahasia yang akan disimpan di dalam QR code.
   - `ADMIN_PASSWORD` — password login admin.
   - `SESSION_SECRET` (opsional) — string acak untuk menandatangani cookie.
4. Deploy. Vercel otomatis mendeteksi `npm run build` dan folder API di `/api`.
5. Buka `https://domain-kamu.vercel.app`, klik **Masuk sebagai admin**, login pakai
   `ADMIN_PASSWORD`.
6. Klik ikon QR di pojok kanan atas (khusus admin) untuk generate dan mengunduh QR code
   yang sudah berisi `ACCESS_KEY`. Cetak/kirim QR itu ke pasanganmu — itulah satu-satunya
   cara masuk sebagai tamu.

Kalau `ACCESS_KEY` atau `ADMIN_PASSWORD` diganti di Vercel, generate ulang QR-nya lewat
tombol yang sama supaya QR lama otomatis tidak berlaku lagi.

## Fitur baru: efek meriah, musik, dan video

- **Sambutan "Halo, sayang"** — muncul otomatis (dengan efek hati) setiap kali tamu
  (bukan admin) membuka buku ini di sesi browser baru.
- **Salju & hati mengambang** — efek partikel salju yang jatuh dan menumpuk di bawah
  layar (lalu meleleh dan mengulang), plus hati-hati kecil yang mengambang pelan di
  latar belakang. Aktif di seluruh halaman.
- **Pemutar musik mengambang** (pojok kiri bawah) — otomatis mencoba memutar lagu saat
  dibuka (browser modern biasanya butuh satu ketukan/klik pertama sebelum suara boleh
  jalan — itu wajar, bukan bug). Semua orang bisa atur volume/mute dari widget ini.
  Admin punya tombol tambahan untuk **upload** (bisa lebih dari satu lagu, otomatis jadi
  playlist berurutan) dan **hapus** lagu.
- **Foto & video di kenangan** — form tambah/edit kenangan sekarang menerima foto *dan*
  video pendek. Video otomatis diputar tanpa suara (seperti gif), dengan tombol kecil di
  pojok untuk menyalakan/mematikan suaranya.
- **Efek transisi** tiap pindah halaman kenangan (sparkle/heart burst + slide), dan kilau
  lembut di setiap foto saat di-hover.

### Catatan soal penyimpanan

Sama seperti sebelumnya, semua data (kenangan, foto, video, dan sekarang musik) disimpan
**lokal di browser masing-masing perangkat** — foto/teks lewat `localStorage`, video dan
musik lewat `IndexedDB` (kapasitasnya jauh lebih besar, tapi tetap per-perangkat/per-browser).
Artinya:

- Musik yang di-upload admin di HP admin **tidak otomatis muncul** di HP pacar yang scan
  QR — itu sesuai batasan yang sama seperti kenangan/foto (lihat catatan di bawah).
- Kalau nanti mau semuanya (kenangan, foto, video, musik) otomatis sinkron di semua
  perangkat, itu perlu database kecil di server (mis. Vercel Blob + Postgres/KV) — kabari
  saja kalau mau ditambahkan, karena project ini sekarang murni client-side storage.

## Ganti gambar "you + me co-op forever"

Setelah login sebagai admin, arahkan kursor/tap ke ilustrasi "you + me co-op forever" di
halaman utama — akan muncul ikon kecil untuk mengunggah gambar transparan (PNG) kamu.
Gambar akan otomatis menggantikan ilustrasi lama, animasi mengambangnya tetap jalan
seperti biasa. Gambar disimpan di penyimpanan lokal browser admin.

## Catatan penting

- Kenangan, foto/video di dalamnya, gambar "you + me", dan playlist musik sekarang
  tersimpan di **Vercel Blob** (database beneran), bukan lagi local storage browser.
  Jadi begitu admin menambah kenangan, siapa pun yang scan QR dari HP mana pun akan
  melihat kenangan yang sama.
- Foto biasanya aman diunggah, tapi video/lagu yang besar (>4.5MB) bisa gagal diunggah
  karena batas ukuran request di Vercel (paket Hobby). Kalau ini jadi masalah, kabari
  saja — bisa diganti ke metode upload langsung-ke-Blob yang tidak kena batas ini.
- Musik di pemutar (`MusicPlayer`) untuk saat ini masih tersimpan lokal per-browser,
  belum ikut dipindah ke Blob. Bilang saja kalau mau playlist musiknya juga disamakan
  di semua perangkat.
- Simpan `ADMIN_PASSWORD` dan `ACCESS_KEY` baik-baik, jangan dibagikan di tempat umum.

## Kalau upload foto/video gagal ("kenangan tidak muncul" / error 413)

- Cek jenis Blob store di **Storage → nama store kamu → Settings → Store Access**. Kalau
  tertulis **Private**, itu penyebabnya — buat store baru dengan akses **Public** (access
  mode tidak bisa diganti setelah store dibuat), lalu connect store yang baru ke project ini.
- Kalau sebelumnya sempat coba-coba dan sekarang buku kenangan gagal dimuat sama sekali
  (GET `/api/memories` error 413 payload too large), itu karena ada data lama (foto dalam
  format base64 dari versi lokal sebelumnya) yang kesimpan kegedean di server. Perbaikannya:
  login admin lalu klik **"reset sample pages"** di menu — ini menimpa data yang rusak
  dengan data kecil yang bersih. Setelah itu upload ulang foto/videonya dari admin.
- Versi ini juga sudah dibuat lebih ketat: foto/video sekarang hanya boleh disimpan sebagai
  link Blob, bukan base64 mentah, supaya masalah di atas tidak terulang.
- Versi ini juga tidak lagi menimpa (overwrite) file `memories.json`/`doodle.json` yang sama
  berulang kali — sebelumnya itu bisa bikin server sesekali membaca data lama yang sudah
  ke-cache padahal sudah ditimpa data baru. Sekarang tiap simpan menulis file baru dan
  membuang yang lama, jadi selalu baca versi terbaru.
- Kalau muncul error `No token found` / `BLOB_READ_WRITE_TOKEN` di logs: pastikan Blob
  store sudah **Connected** ke project ini (tab **Storage**), env var-nya muncul di
  **Settings → Environment Variables** untuk environment **Production**, lalu **redeploy**
  (env var dari integrasi baru cuma berlaku untuk deployment yang dibuat setelahnya).
- Kalau scan QR malah tetap muncul layar terkunci ("masuk sebagai admin"): itu bug lama di
  cara server membaca kode di link QR-nya (`?access=...`), sudah diperbaiki di versi ini.
  Kalau masih kejadian setelah deploy ulang, layar terkunci sekarang akan menampilkan pesan
  error yang lebih jelas — screenshot pesan itu kalau perlu dicek lagi.

## Development lokal

```bash
npm install
npm run dev
```

API routes (`/api/*`) hanya jalan di lingkungan Vercel (`vercel dev`), bukan di `vite dev`
biasa. Untuk tes penuh alur QR + admin, jalankan:

```bash
npm i -g vercel
vercel dev
```
