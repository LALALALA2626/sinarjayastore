// utils.js — Shared utilities for Sinar Jaya SPA

export function fmt(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

export function fmtNum(n) {
  return Math.round(Number(n) || 0).toLocaleString('id-ID');
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDateShort(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escAttr(s) {
  return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

let _toastTimer = null;
export function showToast(message, type = 'success') {
  const existing = document.getElementById('sj-toast');
  if (existing) existing.remove();
  if (_toastTimer) clearTimeout(_toastTimer);

  const toast = document.createElement('div');
  toast.id = 'sj-toast';
  toast.className = `sj-toast sj-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

export function generateNoFakturLocal() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateKey = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const storKey = `sj_ctr_${dateKey}`;
  const counter = (parseInt(localStorage.getItem(storKey) || '0')) + 1;
  localStorage.setItem(storKey, String(counter));
  return `SJ-${dateKey}-${String(counter).padStart(4, '0')}`;
}

export function buildStrukText({ noFaktur, tanggal, namaPelanggan, catatan, items, total, metode }) {
  const W   = 32;               // lebar thermal 58mm = 32 karakter
  const EQ  = '='.repeat(W);   // garis tebal header/footer
  const SEP = '-'.repeat(W);   // garis tipis pemisah item

  /* ── Helpers ─────────────────────────── */

  // Potong string maksimal `max` karakter
  function trunc(s, max) {
    return String(s || '').substring(0, max);
  }

  // Rata tengah dalam lebar W
  function center(s) {
    const str = String(s || '');
    if (str.length >= W) return str.substring(0, W);
    const pad = Math.floor((W - str.length) / 2);
    return ' '.repeat(pad) + str;
  }

  // Kiri + kanan rata dalam lebar W
  function lr(left, right) {
    const r      = String(right || '');
    const l      = trunc(left, W - r.length - 1);
    const spaces = W - l.length - r.length;
    return l + ' '.repeat(spaces > 0 ? spaces : 1) + r;
  }

  // Wrap nama barang agar tidak melebihi W karakter per baris
  function wrapText(text, maxLen) {
    const words = String(text || '-').split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if (!cur) {
        cur = w;
      } else if ((cur + ' ' + w).length <= maxLen) {
        cur += ' ' + w;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.join('\n');
  }

  // Parse qty: "1/2" → 0.5 | "2.5" → 2.5 | "3 dus" → 3
  function parseQty(qtyVal) {
    const s    = String(qtyVal || '1').trim();
    const frac = s.match(/^(\d+)\/(\d+)/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    const num  = parseFloat(s);
    return isNaN(num) || num <= 0 ? 1 : num;
  }

  /* ── Render tiap item ────────────────── */
  const rows = items.map((i, idx) => {
    const numQty     = parseQty(i.qty);
    const qtyDisplay = String(i.qty || '1').trim();
    const satuan     = (i.satuan || 'pcs').trim();
    const hargaFmt   = fmtNum(i.harga);
    const subtotal   = fmtNum(i.harga * numQty);

    // Baris 1: nama barang (auto-wrap jika panjang)
    const namaLine   = wrapText(i.nama || '-', W);

    // Baris 2: qty × harga → subtotal
    const detail     = `  ${qtyDisplay} ${satuan} x ${hargaFmt}`;
    let detailLine;
    if (detail.length + subtotal.length <= W) {
      detailLine = detail + ' '.repeat(W - detail.length - subtotal.length) + subtotal;
    } else {
      // Tidak muat → subtotal di baris baru rata kanan
      detailLine = detail + '\n' + ' '.repeat(W - subtotal.length) + subtotal;
    }

    // Baris kosong antar item (kecuali item terakhir)
    const gap = idx < items.length - 1 ? '\n' : '';
    return namaLine + '\n' + detailLine + gap;
  }).join('\n');

  /* ── Header info ─────────────────────── */
  // Format tanggal singkat dd/mm/yy HH.MM agar muat di 32 char
  function shortDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).substring(0, 20);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
  }
  // Selalu pakai shortDate — tanggal sudah berupa ISO string dari bon.waktu
  const tglDisplay = shortDate(tanggal);

  const noLine      = `No.    : ${noFaktur}`;
  const tglLine     = `Tgl.   : ${tglDisplay}`;
  const kpdLine     = `Kepada : ${trunc(namaPelanggan, 21)}`;
  const catLine     = catatan ? `\nCatatan: ${trunc(catatan, 22)}` : '';

  /* ── Total & Pembayaran ──────────────── */
  const totalFmt    = 'Rp ' + fmtNum(total);
  const totalLine   = lr('TOTAL', totalFmt);
  const metodeLine  = lr('Pembayaran', metode);

  /* ── Susun bon ───────────────────────── */
  return [
    EQ,
    center('TOKO SINAR JAYA'),
    center('Sembako & Kelontong'),
    center('Kota Bandung'),
    EQ,
    noLine,
    tglLine,
    kpdLine + catLine,
    SEP,
    '',
    rows,
    '',
    SEP,
    totalLine,
    metodeLine,
    EQ,
    center('Terima kasih atas'),
    center('kepercayaan Anda!'),
    EQ,
  ].join('\n');
}
