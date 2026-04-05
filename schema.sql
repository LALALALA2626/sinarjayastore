-- =====================================================
-- SCHEMA DATABASE - Sinar Jaya Grocery (Supabase)
-- =====================================================
-- Jalankan script ini di Supabase SQL Editor:
-- https://supabase.com → project → SQL Editor → New query

-- 1. Tabel konfigurasi modul (counter faktur, tanggal sistem)
CREATE TABLE IF NOT EXISTS tm_module (
  id          TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Master Barang
CREATE TABLE IF NOT EXISTS ms_barang (
  kode_barang  TEXT PRIMARY KEY,
  nama_barang  TEXT NOT NULL,
  harga_satuan NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Header Transaksi Penjualan
CREATE TABLE IF NOT EXISTS tr_penjualan (
  no_faktur      TEXT PRIMARY KEY,
  tanggal        DATE NOT NULL,
  total_harga    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_qty      NUMERIC(10,2) NOT NULL DEFAULT 0,
  nama_pelanggan TEXT,
  catatan        TEXT,
  metode         TEXT DEFAULT 'Tunai',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Detail Transaksi Penjualan
CREATE TABLE IF NOT EXISTS tr_penjualan_detail (
  id           BIGSERIAL PRIMARY KEY,
  no_faktur    TEXT NOT NULL REFERENCES tr_penjualan(no_faktur) ON DELETE CASCADE,
  kode_barang  TEXT,
  nama_barang  TEXT NOT NULL,
  qty          NUMERIC(10,2) NOT NULL,
  harga_satuan NUMERIC(15,2) NOT NULL,
  subtotal     NUMERIC(15,2) NOT NULL,
  satuan       TEXT DEFAULT 'pcs'
);

-- 5. Seed data awal tm_module
INSERT INTO tm_module (id, value, updated_at) VALUES
  ('tanggal_sistem',  '', NOW()),
  ('faktur_counter',  '0', NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Row Level Security (akses publik via anon key)
ALTER TABLE tm_module           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ms_barang           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tr_penjualan        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tr_penjualan_detail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON tm_module           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON ms_barang           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tr_penjualan        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON tr_penjualan_detail FOR ALL USING (true) WITH CHECK (true);

-- ✅ Selesai! Tabel siap digunakan.
