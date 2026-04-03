# Sinar Jaya Grocery — Kasir Toko 🛒

Sistem kasir berbasis web untuk **Toko Sinar Jaya — Sembako & Kelontong**.  
Dibangun sebagai **Single Page Application (SPA)** menggunakan Vanilla HTML/CSS/JavaScript dengan backend **Supabase** (PostgreSQL) dan siap deploy ke **Netlify**.

---

## 📋 Gambaran Project

### Fitur Utama

| Halaman | Fungsi |
|---|---|
| **Dashboard** | Ringkasan total penjualan & total qty hari ini |
| **Master Barang** | CRUD data barang (kode, nama, harga satuan) |
| **Transaksi Penjualan** | Input transaksi, pilih barang dari master, generate no faktur otomatis |
| **Laporan** | Laporan rekap / detail dengan filter tanggal & barang, export PDF |

### Stack Teknologi

- **Frontend**: Vanilla HTML5 + CSS3 + JavaScript (ES Modules)
- **Backend/DB**: [Supabase](https://supabase.com) (PostgreSQL)
- **PDF Export**: [html2pdf.js](https://github.com/eKoopmans/html2pdf.js)
- **Fonts**: Google Fonts (Plus Jakarta Sans + Playfair Display)
- **Deploy**: Netlify (static hosting)

### Struktur Database

```
tm_module            ← Counter faktur & tanggal sistem (close toko)
ms_barang            ← Master data barang
tr_penjualan         ← Header transaksi (no faktur, tanggal, total)
tr_penjualan_detail  ← Detail item per faktur
```

### Format No Faktur

```
SJ-20260404-0001
│   │        └── Counter harian (reset otomatis tiap hari baru)
│   └────────── Tanggal transaksi (YYYYMMDD)
└────────────── Kode toko
```

### Struktur File

```
Sinar Jaya Grocery/
├── index.html              ← SPA shell (header + bottom nav)
├── app.js                  ← Hash router + navigasi
├── env.js                  ← 🔧 Konfigurasi Supabase (WAJIB diisi)
├── supabase.js             ← Supabase client (ES Module)
├── utils.js                ← Formatting, toast notifications
├── style.css               ← Global CSS
├── logo.jpg                ← Logo toko
├── pages/
│   ├── dashboard.js        ← Halaman Dashboard
│   ├── master-barang.js    ← Halaman Master Barang
│   ├── transaksi.js        ← Halaman Transaksi Penjualan
│   └── laporan.js          ← Halaman Laporan + PDF
├── schema.sql              ← Script buat tabel di Supabase
├── netlify.toml            ← Konfigurasi deploy Netlify
├── _redirects              ← SPA routing Netlify
└── BT_PRINT_REFERENCE.md  ← Referensi kode Bluetooth Print (future)
```

---

## ⚙️ Konfigurasi Environment

### Langkah 1 — Jalankan `schema.sql` (Buat Tabel Database)

> 💡 `schema.sql` adalah script SQL untuk membuat seluruh **struktur tabel** yang dibutuhkan app
> — mirip seperti "create collection" di MongoDB / "create sheet" di spreadsheet.
> Cukup dijalankan **sekali saja** saat pertama kali setup.
>
> Script ini akan membuat 4 tabel:
> - `tm_module` → menyimpan counter no faktur & tanggal sistem
> - `ms_barang` → master data barang
> - `tr_penjualan` → header transaksi penjualan
> - `tr_penjualan_detail` → detail item per transaksi

**Cara menjalankan:**

1. Buka [supabase.com](https://supabase.com) → login → pilih project Anda
2. Di sidebar kiri, klik ikon **SQL Editor** (ikon database / `</>`)
3. Klik tombol **New query** (pojok kiri atas)
4. Buka file `schema.sql` di folder project menggunakan Notepad atau VS Code
5. **Select All** (`Ctrl+A`) → **Copy** (`Ctrl+C`)
6. Kembali ke Supabase SQL Editor → klik di area teks → **Paste** (`Ctrl+V`)
7. Klik tombol **RUN** (pojok kanan bawah) atau tekan `Ctrl+Enter`
8. Tunggu beberapa detik — jika berhasil muncul pesan:
   ```
   Success. No rows returned
   ```

**Verifikasi tabel berhasil dibuat:**

1. Di sidebar Supabase, klik **Table Editor**
2. Pastikan muncul 4 tabel: `tm_module`, `ms_barang`, `tr_penjualan`, `tr_penjualan_detail`

> ⚠️ Jika muncul error `policy already exists`, tambahkan perintah berikut di awal script
> lalu jalankan ulang seluruh schema:
> ```sql
> DROP TABLE IF EXISTS tr_penjualan_detail, tr_penjualan, ms_barang, tm_module CASCADE;
> ```

---

### Langkah 2 — Ambil Anon Key

1. Masih di Supabase, buka **Settings → API**
2. Pada bagian **Project API keys**, copy nilai **`anon` / `public`**
   > ⚠️ Jangan gunakan `service_role` key — itu untuk server-side saja

### Langkah 3 — Isi `env.js`

Buka file `env.js`, isi `SUPABASE_ANON_KEY` dengan key yang sudah dicopy:

```js
// env.js
window.SUPABASE_URL      = 'https://kgkmlpesuigsvvfsliuf.supabase.co'; // ✅ sudah terisi
window.SUPABASE_ANON_KEY = 'ISI_ANON_KEY_ANDA_DI_SINI';               // ← isi ini
```

> **Catatan tentang format Anon Key:**
> - Supabase versi lama  → diawali `eyJhbGciOiJIUzI1NiI...` (format JWT)
> - Supabase versi baru  → diawali `sb_publishable_...`
>
> Keduanya valid. Cukup copy-paste nilai dari halaman **Settings → API** di Supabase.

---

## 🖥️ Cara Running Local (QC / Testing)

> **Penting**: Karena app menggunakan **ES Modules**, file tidak bisa dibuka langsung via `file://`.  
> Wajib diakses melalui HTTP server lokal.

### Option A — Python (paling mudah, tidak perlu install apapun)

```bash
# Buka terminal / PowerShell di folder project
cd "d:\Sinar Jaya Grocery"

# Python 3 (cek versi: python --version)
python -m http.server 3333

# Buka browser → http://localhost:3333
```

### Option B — Node.js (jika Python tidak tersedia)

```bash
# Install sekali
npm install -g serve

# Jalankan
cd "d:\Sinar Jaya Grocery"
serve . -p 3333

# Buka browser → http://localhost:3333
```

### Option C — VS Code Live Server Extension

1. Install ekstensi **Live Server** di VS Code
2. Buka folder project di VS Code
3. Klik kanan `index.html` → **Open with Live Server**
4. Browser otomatis terbuka di `http://127.0.0.1:5500`

---

## 🚀 Deploy ke Netlify

### Option A — Drag & Drop (Tercepat)

1. Buka [app.netlify.com](https://app.netlify.com)
2. Drag seluruh folder `Sinar Jaya Grocery\` ke area **"Deploy manually"**
3. Tunggu upload selesai → site langsung live!

### Option B — GitHub + Auto Deploy

1. Push folder ke GitHub repository
2. Netlify → **Add new site → Import an existing project**
3. Pilih repo GitHub Anda
4. Konfigurasi:
   - **Build command**: *(kosong / tidak diisi)*
   - **Publish directory**: `.`
5. Klik **Deploy site**

> File `netlify.toml` dan `_redirects` sudah dikonfigurasi untuk SPA routing.

---

## 📝 Catatan Tambahan

### Bluetooth Print
Kode referensi untuk integrasi printer thermal Bluetooth tersedia di `BT_PRINT_REFERENCE.md`.  
Fitur ini belum aktif dan bisa diimplementasikan di masa mendatang.

### Row Level Security
Supabase dikonfigurasi dengan **policy publik** (via anon key) sesuai script `schema.sql`.  
Untuk production dengan keamanan lebih tinggi, pertimbangkan untuk mengimplementasikan autentikasi.

### Browser Support
- ✅ Chrome / Edge (desktop & mobile)
- ✅ Safari (desktop & iOS)  
- ✅ Firefox
- ⚠️ Bluetooth Print: **Chrome Android only**
