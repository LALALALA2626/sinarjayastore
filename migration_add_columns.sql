-- =====================================================
-- MIGRATION: Tambah kolom yang hilang
-- Jalankan di Supabase SQL Editor:
-- https://supabase.com → project → SQL Editor → New query
-- =====================================================

-- Tambah kolom ke tr_penjualan (jika belum ada)
ALTER TABLE tr_penjualan
  ADD COLUMN IF NOT EXISTS nama_pelanggan TEXT,
  ADD COLUMN IF NOT EXISTS catatan        TEXT,
  ADD COLUMN IF NOT EXISTS metode         TEXT DEFAULT 'Tunai';

-- Tambah kolom ke tr_penjualan_detail (jika belum ada)
ALTER TABLE tr_penjualan_detail
  ADD COLUMN IF NOT EXISTS satuan TEXT DEFAULT 'pcs';

-- Tambah tabel tr_hutang untuk fitur Kasbon/Hutang
CREATE TABLE IF NOT EXISTS tr_hutang (
  id             BIGSERIAL PRIMARY KEY,
  no_faktur      TEXT,
  nama_pelanggan TEXT NOT NULL,
  jumlah         NUMERIC(15,2) NOT NULL DEFAULT 0,
  catatan        TEXT,
  tanggal        DATE NOT NULL,
  status         TEXT DEFAULT 'belum_lunas',
  tanggal_lunas  DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tr_hutang ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON tr_hutang FOR ALL USING (true) WITH CHECK (true);

-- ✅ Selesai! Kolom & Tabel berhasil ditambah.
-- Device lain sekarang bisa sync nama pelanggan, catatan, metode, satuan, dan Hutang.
