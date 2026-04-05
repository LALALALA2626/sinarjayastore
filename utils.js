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
  const line = '--------------------------------';

  // Parse qty: support text format like "1/2", "2.5", "1 dus" → extract numeric part
  function parseQty(qtyVal) {
    const s = String(qtyVal || '1').trim();
    // fraction like 1/2
    const frac = s.match(/^(\d+)\/(\d+)/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    // plain number
    const num = parseFloat(s);
    return isNaN(num) ? 1 : num;
  }

  const rows = items.map(i => {
    const numQty = parseQty(i.qty);
    const qtyDisplay = String(i.qty || '1').trim(); // tampilkan teks aslinya
    const satuan = (i.satuan || 'pcs').trim();
    const subtotal = fmtNum(i.harga * numQty);

    // Baris 1: nama barang (penuh, tidak dipotong)
    const namaLine = String(i.nama || '').substring(0, 30);
    // Baris 2: indented qty x harga → subtotal
    const qtyLine = `  ${qtyDisplay} ${satuan} x ${fmtNum(i.harga)}`;
    const rightPad = subtotal.padStart(30 - qtyLine.length > 0 ? 30 - qtyLine.length : 1);
    const detailLine = qtyLine.length + rightPad.length <= 30
      ? qtyLine + rightPad
      : qtyLine + '\n' + ' '.repeat(20) + subtotal;

    return namaLine + '\n' + detailLine;
  }).join('\n');

  return `================================
      TOKO SINAR JAYA
  Sembako & Kelontong Bandung
================================
No      : ${noFaktur}
Tgl     : ${tanggal}
Kepada  : ${namaPelanggan}${catatan ? '\nCatatan : ' + catatan : ''}
${line}
${rows}
${line}
TOTAL          : ${fmtNum(total).padStart(9)}
Pembayaran     : ${metode}
================================
       Terima kasih!
================================`;
}
