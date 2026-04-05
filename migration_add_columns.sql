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

-- ✅ Selesai! Kolom berhasil ditambah.
-- Device lain sekarang bisa sync nama pelanggan, catatan, metode, dan satuan.
