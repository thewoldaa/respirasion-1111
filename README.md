# Respirasion

Respirasion adalah aplikasi chat low-bandwidth berbasis React 18, Vite, dan Firebase. Fokusnya mobile portrait untuk Android, dengan chat teks privat, saluran publik, dan voice call 2 arah real-time tanpa menyimpan rekaman.

## Fitur

- Auth username + password tanpa field email di UI
- User ID acak 6 digit saat registrasi
- Avatar dari 2 huruf awal nama
- Chat privat 1:1 berbasis teks
- Voice call live via WebRTC + Firebase RTDB signaling
- Saluran publik dengan identitas `#UserID`
- Tambah kontak lewat User ID 6 digit
- Pengaturan nama tampil, lihat ID, dan logout

## Menjalankan proyek

```bash
npm install
cp .env.example .env
npm run dev
```

Build produksi:

```bash
npm run build
```

## Environment

`.env` yang dipakai browser:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Firebase

- Realtime Database rules: `firebase-rules.json`
- Hosting config: `firebase.json`
- Path signaling panggilan: `calls/{chatId}`

## Catatan auth

Konversi username ke email internal:

```js
username.toLowerCase().replace(/[^a-z0-9]/g, '') + '@respirasion.app'
```

## Catatan voice call

- Audio dikirim langsung antar pengguna
- Tidak ada upload voice note
- Tidak ada penyimpanan rekaman
- Kedua pengguna harus online bersamaan
