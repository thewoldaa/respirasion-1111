# Respirasion

Respirasion adalah aplikasi chat low-bandwidth berbasis React 18, Vite, dan Firebase. UI mobile-first dibatasi ke lebar 430px dan login hanya memakai username + password. Email Firebase dibentuk internal dari username yang sudah disanitasi.

## Fitur

- Auth username + password tanpa field email di UI
- User ID acak 6 digit saat registrasi
- Avatar dari 2 huruf awal nama
- Chat privat 1:1 untuk teks dan voice note
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

`.env` harus berisi 7 variabel:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Firebase

- Realtime Database rules: `firebase-rules.json`
- Storage rules: `storage.rules`
- Hosting config: `firebase.json`

## Catatan auth

Konversi username ke email internal:

```js
username.toLowerCase().replace(/[^a-z0-9]/g, '') + '@respirasion.app'
```
