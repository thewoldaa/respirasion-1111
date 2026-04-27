# 📋 TUGAS.md — Instruksi untuk AI Agent
## Aplikasi: Respirasion 1111 (Market-sr)

> Dokumen ini dibaca oleh AI agent yang memiliki akses ke **Firebase CLI**, **GitHub API**, dan **Node.js**.  
> Ikuti setiap langkah secara berurutan. Jangan lewati satu pun.

---

## 🎯 RINGKASAN TUGAS

Bangun dan deploy aplikasi chat low-internet bernama **Respirasion** secara otomatis:

1. Buat repository GitHub baru bernama `respirasion-1111`
2. Buat Firebase project bernama `Market-sr`
3. Aktifkan semua layanan Firebase yang diperlukan
4. Generate `.env` dari kredensial Firebase secara otomatis
5. Push semua source code ke GitHub
6. Verifikasi build berhasil

---

## ⚙️ PRASYARAT YANG HARUS ADA

```
- Node.js >= 18
- npm >= 9
- git
- Firebase CLI     → npm install -g firebase-tools
- GitHub CLI (gh)  → https://cli.github.com
```

Cek semua tersedia sebelum mulai:
```bash
node --version && npm --version && git --version && firebase --version && gh --version
```

---

## 📐 SPESIFIKASI APLIKASI

### Stack
- **Frontend:** React 18 + Vite (JavaScript, bukan TypeScript)
- **Backend:** Firebase (Auth + Realtime Database + Storage)
- **UI:** Design system "Connectivity & Clarity" — light theme, Inter font, Material Symbols
- **Target:** Mobile portrait, max-width 430px, responsive semua resolusi

### Fitur Wajib
| Fitur | Detail |
|---|---|
| Auth | **Username + Password saja** — tidak ada field email di UI |
| Avatar | Inisial 2 huruf pertama username, warna tonal otomatis |
| User ID | 6-digit angka acak unik, dibuat saat register |
| Chat Privat | 1:1, teks + pesan suara (tahan mic untuk rekam) |
| Saluran Publik | Semua user bisa chat, identitas = `#UserID` bukan nama |
| Add Kontak | Via User ID 6-digit (seperti WhatsApp tapi pakai ID) |
| Settings | Ubah nama tampil, lihat ID, logout |
| Low-bandwidth | Firebase RTDB `limitToLast(80-100)`, compressed audio |

### Autentikasi — PENTING
> User hanya memasukkan **username** dan **password**.  
> Konversi ke email Firebase dilakukan **secara internal** (tersembunyi dari user):
```
email_firebase = username.toLowerCase().replace(/[^a-z0-9]/g, '') + "@respirasion.app"
```
> UI tidak pernah menampilkan field email.

---

## 🔥 LANGKAH 1 — SETUP FIREBASE

### 1.1 Login Firebase
```bash
firebase login
```

### 1.2 Buat Project Firebase
```bash
firebase projects:create market-sr --display-name "Market-sr"
```

Jika project ID `market-sr` sudah ada, gunakan suffix:
```bash
firebase projects:create market-sr-app --display-name "Market-sr"
# Catat project ID yang berhasil dibuat
```

### 1.3 Set project aktif
```bash
firebase use market-sr
```

### 1.4 Aktifkan Firebase Authentication (Email/Password)
```bash
# Via Firebase REST Management API
PROJECT_ID="market-sr"

# Enable Identity Platform / Auth
firebase --project=$PROJECT_ID auth:import /dev/null 2>/dev/null || true

# Aktifkan Email/Password provider via gcloud atau Management API:
curl -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "signIn": {
      "email": { "enabled": true, "passwordRequired": true }
    }
  }'
```

**Alternatif manual** (jika API gagal):  
Buka https://console.firebase.google.com/project/market-sr/authentication/providers → aktifkan Email/Password.

### 1.5 Buat Realtime Database
```bash
firebase database:create \
  --project market-sr \
  --location asia-southeast1 \
  --default-rules '{"rules":{".read":"auth != null",".write":"auth != null"}}'
```

Setelah database dibuat, terapkan rules keamanan final:
```bash
cat > /tmp/db-rules.json << 'EOF'
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "userIds": {
      ".read":  "auth != null",
      "$id": { ".write": "auth != null" }
    },
    "contacts": {
      "$uid": {
        ".read":  "auth != null && auth.uid == $uid",
        ".write": "auth != null"
      }
    },
    "chats": {
      "$chatId": {
        ".read":  "auth != null && $chatId.contains(auth.uid)",
        ".write": "auth != null && $chatId.contains(auth.uid)"
      }
    },
    "public": {
      "messages": {
        ".read":  "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
EOF

firebase database:rules:update /tmp/db-rules.json --project market-sr
```

### 1.6 Aktifkan Storage
```bash
firebase storage:buckets:create gs://market-sr.appspot.com \
  --project market-sr \
  --location asia-southeast1 2>/dev/null || true
```

Storage rules:
```bash
cat > /tmp/storage-rules.storage << 'EOF'
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /voice/{chatId}/{file} {
      allow read, write: if request.auth != null;
    }
  }
}
EOF

firebase deploy --only storage --project market-sr
```

### 1.7 Ambil Web App Credentials
```bash
# Buat Web App di project
firebase apps:create WEB "Respirasion Web" --project market-sr

# Ambil App ID
APP_ID=$(firebase apps:list --project market-sr --json | \
  python3 -c "import sys,json; apps=json.load(sys.stdin)['result']; print(apps[0]['appId'])")

echo "App ID: $APP_ID"

# Ambil config SDK
firebase apps:sdkconfig WEB $APP_ID --project market-sr > /tmp/firebase-config.json
cat /tmp/firebase-config.json
```

### 1.8 Parse dan Simpan ke .env
```bash
python3 << 'PYEOF'
import json, re

with open('/tmp/firebase-config.json') as f:
    raw = f.read()

# Extract JSON object dari output firebase CLI
match = re.search(r'\{.*\}', raw, re.DOTALL)
if not match:
    raise ValueError("Tidak bisa parse config Firebase")

cfg = json.loads(match.group())
fc  = cfg.get('result', cfg)  # firebase CLI wraps in result sometimes

env_content = f"""# Auto-generated by tugas.md agent
VITE_FIREBASE_API_KEY={fc.get('apiKey', '')}
VITE_FIREBASE_AUTH_DOMAIN={fc.get('authDomain', '')}
VITE_FIREBASE_DATABASE_URL={fc.get('databaseURL', '')}
VITE_FIREBASE_PROJECT_ID={fc.get('projectId', '')}
VITE_FIREBASE_STORAGE_BUCKET={fc.get('storageBucket', '')}
VITE_FIREBASE_MESSAGING_SENDER_ID={fc.get('messagingSenderId', '')}
VITE_FIREBASE_APP_ID={fc.get('appId', '')}
"""

# Tulis ke file project
with open('.env', 'w') as f:
    f.write(env_content)

print("✅ .env berhasil dibuat!")
print(env_content)
PYEOF
```

---

## 🐙 LANGKAH 2 — SETUP GITHUB REPOSITORY

### 2.1 Login GitHub CLI
```bash
gh auth login
```

### 2.2 Buat Repository
```bash
gh repo create respirasion-1111 \
  --public \
  --description "Low-bandwidth 2-way text & voice chat app built with React + Firebase" \
  --clone=false

echo "✅ Repo dibuat: https://github.com/$(gh api user --jq .login)/respirasion-1111"
```

### 2.3 Inisialisasi Git di folder project
```bash
cd respirasion-1111    # folder project hasil unzip/clone source code

git init
git remote add origin https://github.com/$(gh api user --jq .login)/respirasion-1111.git
```

---

## 📁 LANGKAH 3 — STRUKTUR FILE YANG HARUS ADA

Pastikan semua file berikut **ada** sebelum push. Jika tidak ada, buat dari template di bawah.

```
respirasion-1111/
├── index.html
├── package.json
├── vite.config.js
├── .env                   ← dibuat di Langkah 1.8
├── .env.example
├── .gitignore
├── firebase-rules.json
├── firebase.json          ← dibuat di Langkah 3.1
├── README.md
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── firebase.js
    ├── styles/
    │   └── global.css
    ├── utils/
    │   └── helpers.js
    ├── context/
    │   ├── AuthContext.jsx
    │   └── ToastContext.jsx
    └── components/
        ├── UI/
        │   └── Avatar.jsx
        ├── Auth/
        │   └── AuthPage.jsx        ← USERNAME + PASSWORD ONLY
        ├── Chat/
        │   ├── ChatList.jsx
        │   ├── ChatRoom.jsx
        │   └── PublicChannel.jsx
        ├── Contacts/
        │   └── Contacts.jsx
        └── Settings/
            └── Settings.jsx
```

### 3.1 Buat firebase.json
```bash
cat > firebase.json << 'EOF'
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "database": {
    "rules": "firebase-rules.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
EOF
```

### 3.2 Buat storage.rules
```bash
cat > storage.rules << 'EOF'
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /voice/{chatId}/{file} {
      allow read, write: if request.auth != null;
    }
  }
}
EOF
```

---

## ✅ LANGKAH 4 — VERIFIKASI KODE KRITIS

Sebelum push, verifikasi hal-hal berikut di source code:

### 4.1 Cek AuthPage.jsx — TIDAK BOLEH ADA FIELD EMAIL
```bash
# Tidak boleh ada kata "email" di dalam form yang ditampilkan user
grep -n "email" src/components/Auth/AuthPage.jsx | grep -v "//" | grep -v "internal\|firebase\|auto"
# Output harus KOSONG atau hanya komentar
```

### 4.2 Cek AuthContext.jsx — Konversi email tersembunyi harus ada
```bash
grep -n "toFirebaseEmail\|@respirasion.app" src/context/AuthContext.jsx
# Harus ada baris yang mengandung @respirasion.app
```

### 4.3 Cek helpers.js — generateId harus 6 digit
```bash
grep -n "generateId\|100000\|900000" src/utils/helpers.js
# Harus: Math.floor(100000 + Math.random() * 900000).toString()
```

### 4.4 Cek .env sudah terisi
```bash
cat .env | grep -v "^#" | grep -v "^$"
# Semua VITE_FIREBASE_* harus memiliki nilai, bukan placeholder
```

### 4.5 Cek max-width di CSS
```bash
grep -n "max-width.*430\|430px" src/styles/global.css
# Harus ada untuk memastikan layout mobile portrait
```

---

## 📦 LANGKAH 5 — INSTALL, BUILD, DAN TEST

### 5.1 Install dependencies
```bash
npm install
```

### 5.2 Test build
```bash
npm run build
# Harus selesai tanpa error
# Output: dist/ folder
```

### 5.3 Test lokal
```bash
npm run preview &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173
# Harus return: 200
```

---

## 🚀 LANGKAH 6 — PUSH KE GITHUB

### 6.1 Buat .gitignore yang benar
```bash
cat > .gitignore << 'EOF'
node_modules
dist
.env
.env.local
.DS_Store
*.log
EOF
```

### 6.2 Commit dan push
```bash
git add .
git commit -m "feat: initial Respirasion app - Connectivity & Clarity UI

- React 18 + Vite + Firebase RTDB
- Auth: username/password only (no email in UI)
- Auto-generated 6-digit User ID on register
- Private 1:1 chat with text + voice messages
- Public channel with ID-only identity
- Contacts via 6-digit ID lookup
- Settings: change display name
- Design: Connectivity & Clarity light theme
- Optimized for low-bandwidth connections"

git branch -M main
git push -u origin main
```

### 6.3 Verifikasi push berhasil
```bash
gh repo view respirasion-1111 --web 2>/dev/null || \
  echo "Repo: https://github.com/$(gh api user --jq .login)/respirasion-1111"
```

---

## 🌐 LANGKAH 7 (OPSIONAL) — DEPLOY KE FIREBASE HOSTING

```bash
# Build production
npm run build

# Deploy ke Firebase Hosting
firebase deploy --project market-sr

# URL akan ditampilkan setelah deploy:
# Hosting URL: https://market-sr.web.app
```

---

## 🔐 KEAMANAN — CHECKLIST WAJIB

```
[ ] .env TIDAK di-commit ke git (ada di .gitignore)
[ ] .env.example berisi VITE_FIREBASE_* dengan nilai placeholder
[ ] Firebase Rules hanya izinkan authenticated users
[ ] Storage rules hanya izinkan baca/tulis voice/ path
[ ] Auth hanya Email/Password (no Google, no Phone)
[ ] Username di-sanitize sebelum jadi email: replace(/[^a-z0-9]/g, '')
```

---

## 🗄️ SKEMA DATABASE FIREBASE

```
/users/{uid}
  uid: string
  username: string
  userId: string          ← 6-digit ID
  displayName: string
  initials: string        ← 2 huruf kapital
  createdAt: number
  online: boolean
  lastSeen: number

/userIds/{6digitId}       ← maps userId → uid (untuk lookup)
  value: uid

/contacts/{uid}/{contactUid}
  uid: string
  addedAt: number

/chats/{uid1_uid2}/messages/{msgId}
  senderId: string
  type: "text" | "voice"
  text?: string
  voiceUrl?: string
  ts: number

/chats/{uid1_uid2}/lastMsg
  (same as message object)

/public/messages/{msgId}
  senderId: string
  userId: string          ← 6-digit ID (tampil di UI)
  initials: string
  text: string
  ts: number
```

> `chatId` selalu berupa `[uid1, uid2].sort().join('_')` — konsisten dari kedua sisi.

---

## 🐛 TROUBLESHOOTING

| Error | Solusi |
|---|---|
| `auth/email-already-in-use` | Username sudah dipakai — tampilkan "Username sudah dipakai" |
| `auth/weak-password` | Password < 6 karakter — validasi di frontend |
| `auth/invalid-email` | Username mengandung karakter tidak valid — sanitize lebih ketat |
| `PERMISSION_DENIED` | Firebase Rules belum diterapkan — jalankan Langkah 1.5 |
| `database URL not found` | `VITE_FIREBASE_DATABASE_URL` kosong di `.env` |
| Build error: `global is not defined` | Pastikan `vite.config.js` punya `define: { global: 'globalThis' }` |
| Voice tidak bisa upload | Storage rules belum aktif, atau bucket URL salah |
| MediaRecorder gagal | Browser tidak support `audio/webm;codecs=opus` — fallback ke `audio/webm` |

---

## 📊 RINGKASAN ENVIRONMENT VARIABLES

File `.env` yang dihasilkan harus berisi tepat 7 variabel:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=market-sr.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://market-sr-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=market-sr
VITE_FIREBASE_STORAGE_BUCKET=market-sr.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> `VITE_` prefix wajib — Vite hanya expose env variable dengan prefix ini ke browser.

---

## ✅ DEFINISI SELESAI

Tugas dianggap **berhasil** jika:

1. ✅ Repository `respirasion-1111` ada di GitHub dan public
2. ✅ `npm run build` menghasilkan folder `dist/` tanpa error
3. ✅ Firebase project `market-sr` aktif dengan Auth + RTDB + Storage
4. ✅ `.env` berisi semua 7 kredensial Firebase yang valid
5. ✅ UI login/register **tidak memiliki field email** — hanya username & password
6. ✅ User dapat register → mendapat ID 6-digit → kirim pesan → rekam suara
7. ✅ Saluran publik menampilkan `#UserID` bukan nama

---

*Dokumen ini dapat dibaca ulang oleh AI agent kapanpun diperlukan untuk melanjutkan atau memperbaiki setup.*
