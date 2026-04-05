// pages/kasir.js — Kasir Manual (Bon Cepat)
import { fmt, fmtDateTime, showToast, buildStrukText, generateNoFakturLocal } from '../utils.js';
import { db, isConfigured } from '../supabase.js';

const SATUANS = ['pcs', 'kg', 'gr', 'bungkus', 'renceng', 'karton', 'lusin', 'pack', 'botol', 'liter', 'ikat', 'biji', 'sak', 'lbr', 'dus'];

let _items = [];
let _itemId = 0;
let _metode = 'Tunai';
let _bleChar = null;

/* ===== GENERATE KODE BARANG ===== */
function _generateKode(nama) {
  const clean = nama.toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map(w => w.substring(0, 4))
    .join('')
    .substring(0, 10);
  const rand = Math.floor(Math.random() * 900 + 100);
  return clean + '-' + rand;
}

/* ===== ENTRY POINT ===== */
export async function renderKasir(container) {
  _items = [];
  _itemId = 0;
  _metode = 'Tunai';

  const todayKey = new Date().toISOString().slice(0, 10);
  const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
  const bonHari = allBon.filter(b => b.waktu.slice(0, 10) === todayKey);
  const revHari = bonHari.reduce((s, b) => s + b.total, 0);

  container.innerHTML = `
    <div class="gap-12">

      <div class="stats-grid" style="margin-bottom:0">
        <div class="stat-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-lbl">Bon hari ini</div>
          <div class="stat-val" id="k-bon-count">${bonHari.length} bon</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-lbl">Pemasukan</div>
          <div class="stat-val" id="k-rev">${fmt(revHari)}</div>
        </div>
      </div>

      <div class="card">
        <div class="sec-lbl">Informasi Bon</div>
        <div class="field">
          <label>Ditujukan kepada *</label>
          <input id="k-nama" type="text" placeholder="Nama pelanggan..."
            autocomplete="off" autocorrect="off" autocapitalize="words">
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Catatan (opsional)</label>
          <input id="k-catatan" type="text"
            placeholder="Mis: hutang, titip barang..." autocomplete="off">
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="sec-lbl" style="margin:0">Daftar Barang</div>
          <button class="btn btn-secondary btn-sm" onclick="KASIR.addItem()">+ Tambah Barang</button>
        </div>
        <div class="card" style="padding:12px 14px">
          <div id="k-col-labels" style="display:none;grid-template-columns:1fr 72px 52px 66px 30px;gap:5px;margin-bottom:6px">
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Nama barang</div>
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:right">Harga</div>
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:center">Qty</div>
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;text-align:center">Satuan</div>
            <div></div>
          </div>
          <div id="k-items-list"></div>
          <div id="k-empty" class="empty" style="padding:20px 0">
            <div class="empty-ico">🛒</div>
            <div>Belum ada barang.<br>Tap <b>+ Tambah Barang</b> untuk mulai.</div>
          </div>
        </div>

        <div id="k-produk-cache-wrap" style="margin-top:10px;display:none">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">
            🍪 Produk Tersimpan
            <span style="font-weight:400;font-size:9px;margin-left:8px;text-transform:none;letter-spacing:0;color:var(--muted)">· tap untuk langsung tambah</span>
          </div>
          <div id="k-produk-chips" style="display:flex;flex-wrap:wrap;gap:6px"></div>
        </div>

        <div style="margin-top:10px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">
            Jumlah cepat
            <span style="font-weight:400;font-size:9px;margin-left:8px;text-transform:none;letter-spacing:0;color:var(--muted)">· bisa ketik pecahan: 1/2, 1/4 ...</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['1/4','1/3','1/2','2/3','3/4','1.5','2','3','5','10'].map(q => `
              <button style="padding:5px 11px;border-radius:20px;border:1.5px solid var(--border);
                background:var(--white);font-size:12px;font-weight:600;cursor:pointer;
                color:var(--muted);font-family:'Plus Jakarta Sans',sans-serif"
                onclick="KASIR.setQty('${q}')">${q}</button>
            `).join('')}
          </div>
        </div>

        <div style="margin-top:10px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">
            Satuan cepat
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${SATUANS.map(s => `
              <button style="padding:5px 11px;border-radius:20px;border:1.5px solid var(--border);
                background:var(--white);font-size:12px;font-weight:600;cursor:pointer;
                color:var(--muted);font-family:'Plus Jakarta Sans',sans-serif"
                onclick="KASIR.setSatuan('${s}')">${s}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <div id="k-summary-wrap" style="display:none">
        <div class="sec-lbl">Ringkasan Belanja</div>
        <div class="summary-box">
          <div id="k-sum-rows"></div>
          <hr class="sum-divider">
          <div class="sum-total">
            <div class="sum-total-lbl">Total</div>
            <div class="sum-total-val" id="k-sum-val">Rp 0</div>
          </div>
        </div>
      </div>

      <div>
        <div class="sec-lbl">Cara Pembayaran</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <button class="k-metode active" id="km-Tunai"    onclick="KASIR.setMetode('Tunai')">💵<br>Tunai</button>
          <button class="k-metode"        id="km-Transfer" onclick="KASIR.setMetode('Transfer')">📲<br>Transfer</button>
          <button class="k-metode"        id="km-Hutang"   onclick="KASIR.setMetode('Hutang')">📋<br>Hutang</button>
        </div>
      </div>

      <button class="btn btn-primary" onclick="KASIR.buatBon()">✅ Buat Bon &amp; Cetak</button>
      <button class="btn btn-outline"  onclick="KASIR.reset()">🔄 Bersihkan &amp; Mulai Baru</button>

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="sec-lbl" style="margin:0">Riwayat Bon</div>
          <button class="btn btn-danger btn-sm" onclick="KASIR.hapusBonHariIni()" style="font-size:12px;padding:6px 12px">🗑️ Hapus Hari Ini</button>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <input id="k-search" type="text" placeholder="Cari nama pelanggan..."
            oninput="KASIR.filterRiwayat()"
            style="flex:1;min-width:140px;padding:9px 12px;border:1.5px solid var(--border);
            border-radius:10px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;
            background:#fafafa;color:var(--text)">
          <input id="k-filter-tgl" type="date" onchange="KASIR.filterRiwayat()"
            style="padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;
            font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;background:#fafafa;color:var(--text)">
        </div>
        <div id="k-riwayat"></div>
      </div>

    </div>`;

  _renderItems();
  _renderRiwayat();
  _renderProductCacheChips();
}

/* ===== RENDER ITEMS ===== */
function _renderItems() {
  const el = document.getElementById('k-items-list');
  const emp = document.getElementById('k-empty');
  const sw = document.getElementById('k-summary-wrap');
  const cols = document.getElementById('k-col-labels');
  if (!el) return;

  if (!_items.length) {
    el.innerHTML = '';
    if (emp) emp.style.display = 'block';
    if (sw) sw.style.display = 'none';
    if (cols) cols.style.display = 'none';
    return;
  }

  if (emp) emp.style.display = 'none';
  if (sw) sw.style.display = 'block';
  if (cols) cols.style.display = 'grid';

  // Datalist dari local product cache (bukan dari bon history)
  const cache = _loadProductCache();
  const datalistOpts = cache.map(p => `<option value="${_escHtml(p.nama)}">`).join('');

  el.innerHTML = `<datalist id="k-nama-list">${datalistOpts}</datalist>` +
    _items.map(it => `
    <div data-item-id="${it.id}" style="display:grid;grid-template-columns:1fr 72px 52px 66px 30px;gap:5px;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">
      <input class="ii k-nama-inp" placeholder="Nama barang"
        value="${_escHtml(it.nama)}"
        list="k-nama-list"
        oninput="KASIR.updItem(${it.id},'nama',this.value)"
        onchange="KASIR.autoFill(${it.id},this.value)"
        autocomplete="off">
      <input class="ii k-harga-inp" style="text-align:right" placeholder="0" type="number"
        value="${it.harga || ''}"
        oninput="KASIR.updItem(${it.id},'harga',this.value)" inputmode="numeric">
      <input class="ii" type="text"
        value="${it.qty}" placeholder="1"
        oninput="KASIR.updItem(${it.id},'qty',this.value)"
        inputmode="decimal"
        style="text-align:center;font-size:12px"
        title="Format: 1 · 0.5 · 1/2 · 1/4 · dsb">
      <select class="k-satuan-sel" style="padding:9px 4px;border:1.5px solid var(--border);border-radius:var(--radius-xs);
        font-size:11px;font-family:'Plus Jakarta Sans',sans-serif;color:var(--text);
        background:#fafafa;width:100%;cursor:pointer;appearance:none;-webkit-appearance:none;text-align:center"
        onchange="KASIR.updItem(${it.id},'satuan',this.value)">
        ${SATUANS.map(s => `<option value="${s}"${it.satuan === s ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
      <button class="btn btn-danger btn-icon btn-sm"
        onclick="KASIR.removeItem(${it.id})">✕</button>
    </div>`).join('');

  _renderSummary();
}

/* ===== RENDER PRODUK CACHE CHIPS ===== */
function _renderProductCacheChips() {
  const wrap = document.getElementById('k-produk-cache-wrap');
  const el   = document.getElementById('k-produk-chips');
  if (!wrap || !el) return;

  const cache = _loadProductCache();
  if (!cache.length) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'block';
  el.innerHTML = cache.slice(0, 24).map((p, idx) => `
    <button style="padding:5px 12px;border-radius:20px;border:1.5px solid #d1fae5;
      background:#f0fdf4;font-size:12px;font-weight:600;cursor:pointer;
      color:#065f46;font-family:'Plus Jakarta Sans',sans-serif;
      display:inline-flex;align-items:center;gap:6px;white-space:nowrap"
      onclick="KASIR.addFromCache(${idx})">
      ${_escHtml(p.nama)}
      <span style="font-weight:400;opacity:.7;font-size:11px">${fmt(p.harga)}</span>
    </button>`).join('');
}

/* ===== RENDER SUMMARY ===== */
function _renderSummary() {
  const rowsEl = document.getElementById('k-sum-rows');
  const valEl = document.getElementById('k-sum-val');
  if (!rowsEl) return;

  const valid = _items.filter(i => i.nama || i.harga);
  rowsEl.innerHTML = valid.map(i => {
    const numQty = _parseQtyText(i.qty);
    return `
    <div class="sum-row">
      <span>${_escHtml(i.nama || '—')}
        <span style="opacity:.7;font-size:12px"> ${i.qty} ${i.satuan}</span>
      </span>
      <span style="font-weight:700">${fmt(i.harga * numQty)}</span>
    </div>`;
  }).join('');

  const total = valid.reduce((s, i) => s + i.harga * _parseQtyText(i.qty), 0);
  if (valEl) valEl.textContent = fmt(total);
}

/* ===== RENDER RIWAYAT ===== */
async function _renderRiwayat() {
  const tglEl = document.getElementById('k-filter-tgl');
  if (tglEl && !tglEl.value) {
    tglEl.value = new Date().toISOString().slice(0, 10);
  }

  // Sinkron localStorage vs Supabase lalu update count/rev
  await _syncBonFromSupabase();

  const todayKey = new Date().toISOString().slice(0, 10);
  const allBon   = JSON.parse(localStorage.getItem('sj_bon') || '[]');
  const bonHari  = allBon.filter(b => b.waktu.slice(0, 10) === todayKey);
  const revTotal = bonHari.reduce((s, b) => s + b.total, 0);
  const cntEl    = document.getElementById('k-bon-count');
  const revEl    = document.getElementById('k-rev');
  if (cntEl) cntEl.textContent = bonHari.length + ' bon';
  if (revEl) revEl.textContent = fmt(revTotal);
  KASIR.filterRiwayat();
}

/* ===== SHOW STRUK MODAL ===== */
function _showStruk(bon, isView = false) {
  const struktxt = buildStrukText({
    noFaktur: bon.noFaktur,
    tanggal: fmtDateTime(bon.waktu),
    namaPelanggan: bon.namaPelanggan,
    catatan: bon.catatan,
    items: bon.items,
    total: bon.total,
    metode: bon.metode,
  });

  const safeTxt = struktxt.replace(/`/g, "'");
  const mc = document.getElementById('modal-container');

  mc.innerHTML = `
    <div class="modal-backdrop" id="k-modal" onclick="KASIR._closeModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="drag-bar"></div>
        <div class="sheet-title">${isView ? '🧾 Detail Bon' : '✅ Bon Berhasil Dibuat'}</div>
        <div style="font-family:monospace;background:#f9fafb;border-radius:12px;
          padding:14px;font-size:12px;line-height:1.9;color:var(--text);
          white-space:pre;overflow-x:auto;margin-bottom:14px;
          border:1px solid var(--border)">${struktxt}</div>
        <button style="display:flex;align-items:center;gap:10px;width:100%;padding:14px 16px;
          background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:13px;
          font-size:14px;font-weight:600;cursor:pointer;color:#166534;
          font-family:'Plus Jakarta Sans',sans-serif;margin-bottom:10px"
          onclick="KASIR._printBT(\`${safeTxt}\`)">
          <div class="ble-dot${_bleChar ? ' on' : ''}" id="k-bdot"></div>
          <span id="k-btext">${_bleChar ? 'Cetak lagi ke printer' : 'Sambungkan printer Bluetooth'}</span>
        </button>
        <button class="btn btn-primary" onclick="${isView ? 'KASIR._closeModal()' : 'KASIR._closeModal();KASIR.reset()'}">
          ${isView ? 'Tutup' : '🆕 Bon Baru'}
        </button>
      </div>
    </div>`;
}

/* ===== SYNC BON DARI SUPABASE KE LOCALSTORAGE ===== */
// Ambil bon dari Supabase untuk tanggal filter aktif (atau hari ini),
// lalu merge ke localStorage. Bon yang sudah ada (by noFaktur) tidak diduplikat.
async function _syncBonFromSupabase() {
  if (!isConfigured || !db) return;

  const tglEl = document.getElementById('k-filter-tgl');
  const tgl   = (tglEl && tglEl.value) || new Date().toISOString().slice(0, 10);

  try {
    // Ambil header bon
    const { data: headers } = await db
      .from('tr_penjualan')
      .select('no_faktur, tanggal, total_harga, created_at, metode')
      .eq('tanggal', tgl)
      .order('created_at', { ascending: false });

    if (!headers || !headers.length) return;

    // Ambil detail semua bon sekaligus
    const fakturList = headers.map(h => h.no_faktur);
    const { data: details } = await db
      .from('tr_penjualan_detail')
      .select('no_faktur, nama_barang, kode_barang, qty, harga_satuan, subtotal')
      .in('no_faktur', fakturList);

    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const existingFaktur = new Set(allBon.map(b => b.noFaktur));
    let changed = false;

    for (const h of headers) {
      if (existingFaktur.has(h.no_faktur)) continue; // sudah ada

      const itemDetails = (details || []).filter(d => d.no_faktur === h.no_faktur);
      const bon = {
        id           : Date.now() + Math.random(), // pseudo-id unik
        noFaktur     : h.no_faktur,
        waktu        : h.created_at || (tgl + 'T00:00:00.000Z'),
        namaPelanggan: '(dari server)',
        catatan      : '',
        metode       : h.metode || 'Tunai',
        total        : h.total_harga,
        items        : itemDetails.map(d => ({
          nama   : d.nama_barang,
          harga  : d.harga_satuan,
          qty    : String(d.qty),
          satuan : 'pcs',
          kode_barang: d.kode_barang,
        })),
        _fromServer: true, // flag: data ini dari Supabase
      };
      allBon.push(bon);
      changed = true;
    }

    if (changed) localStorage.setItem('sj_bon', JSON.stringify(allBon));
  } catch (e) {
    console.warn('[syncBon] Gagal fetch dari Supabase:', e.message);
  }
}

/* ===== LOCAL PRODUCT CACHE (Cookie-like) ===== */
// Produk yang pernah dipakai disimpan di localStorage sj_produk_cache.
// Tidak auto-insert ke ms_barang agar tidak duplikat.
const _CACHE_KEY = 'sj_produk_cache';

function _loadProductCache() {
  try { return JSON.parse(localStorage.getItem(_CACHE_KEY) || '[]'); } catch { return []; }
}

function _saveProductsToCache(items) {
  const cache = _loadProductCache();
  const cacheMap = {};
  cache.forEach(p => { cacheMap[p.nama.trim().toLowerCase()] = p; });

  items.forEach(i => {
    if (!i.nama) return;
    const key = i.nama.trim().toLowerCase();
    cacheMap[key] = {
      nama    : i.nama.trim(),
      harga   : i.harga  || 0,
      satuan  : i.satuan || 'pcs',
      lastUsed: new Date().toISOString(),
    };
  });

  // Urutkan terbaru di depan, simpan max 100
  const sorted = Object.values(cacheMap)
    .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
    .slice(0, 100);
  localStorage.setItem(_CACHE_KEY, JSON.stringify(sorted));
}

/* ===== GLOBAL KASIR OBJECT ===== */
window.KASIR = {
  addItem() {
    _items.push({ id: ++_itemId, nama: '', harga: 0, qty: 1, satuan: 'pcs' });
    _renderItems();
    setTimeout(() => {
      const inputs = document.querySelectorAll('.k-nama-inp');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 60);
  },

  removeItem(id) {
    _items = _items.filter(i => i.id !== id);
    _renderItems();
  },

  updItem(id, field, val) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    if (field === 'nama' || field === 'satuan' || field === 'qty') {
      item[field] = val; // qty disimpan sebagai teks mentah, diparse saat kalkulasi
    } else {
      item[field] = parseFloat(val) || 0;
    }
    _renderSummary();
  },

  setSatuan(s) {
    if (!_items.length) {
      _items.push({ id: ++_itemId, nama: '', harga: 0, qty: 1, satuan: s });
      _renderItems();
      setTimeout(() => {
        const inputs = document.querySelectorAll('.k-nama-inp');
        if (inputs.length) inputs[inputs.length - 1].focus();
      }, 60);
      return;
    }
    _items[_items.length - 1].satuan = s;
    _renderItems();
  },

  setQty(q) {
    if (!_items.length) return;
    _items[_items.length - 1].qty = q;
    _renderItems();
  },

  addFromCache(idx) {
    const cache = _loadProductCache();
    const p = cache[idx];
    if (!p) return;
    _items.push({ id: ++_itemId, nama: p.nama, harga: p.harga, qty: 1, satuan: p.satuan || 'pcs' });
    _renderItems();
    _renderProductCacheChips();
    setTimeout(() => {
      const list = document.getElementById('k-items-list');
      if (list) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  },

  autoFill(id, nama) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    const cache = _loadProductCache();
    const match = cache.find(p => p.nama.toLowerCase() === nama.trim().toLowerCase());
    if (!match) return;
    item.harga  = match.harga;
    item.satuan = match.satuan || 'pcs';
    // Update DOM langsung (tanpa full re-render agar fokus tidak hilang)
    const row = document.querySelector(`[data-item-id="${id}"]`);
    if (row) {
      const hEl = row.querySelector('.k-harga-inp');
      if (hEl) hEl.value = match.harga;
      const sEl = row.querySelector('.k-satuan-sel');
      if (sEl) sEl.value = match.satuan || 'pcs';
    }
    _renderSummary();
  },

  async hapusBonHariIni() {
    const todayKey = new Date().toISOString().slice(0, 10);
    const allBon   = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const todayBon = allBon.filter(b => b.waktu.slice(0, 10) === todayKey);
    if (!todayBon.length) { showToast('Tidak ada bon hari ini', 'info'); return; }

    if (!confirm(`Hapus ${todayBon.length} bon hari ini (${todayKey})?\n\nData tidak bisa dikembalikan.`)) return;

    const newList = allBon.filter(b => b.waktu.slice(0, 10) !== todayKey);
    localStorage.setItem('sj_bon', JSON.stringify(newList));

    if (isConfigured && db) {
      try {
        const fakturList = todayBon.map(b => b.noFaktur).filter(Boolean);
        if (fakturList.length) {
          await db.from('tr_penjualan_detail').delete().in('no_faktur', fakturList);
          await db.from('tr_hutang').delete().in('no_faktur', fakturList);
        }
        await db.from('tr_penjualan').delete().eq('tanggal', todayKey);
      } catch (err) {
        console.warn('Gagal hapus dari Supabase:', err.message);
      }
    }

    showToast(`${todayBon.length} bon hari ini berhasil dihapus 🗑️`, 'success');
    _renderRiwayat();
  },

  setMetode(m) {
    _metode = m;
    ['Tunai', 'Transfer', 'Hutang'].forEach(x => {
      const el = document.getElementById('km-' + x);
      if (el) el.className = 'k-metode' + (x === m ? ' active' : '');
    });
  },

  filterRiwayat() {
    const q   = (document.getElementById('k-search')?.value || '').toLowerCase();
    const tgl = document.getElementById('k-filter-tgl')?.value || '';

    // Jika tanggal berubah, sync ulang dari Supabase di background
    if (tgl && tgl !== (this._lastFilterTgl || '')) {
      this._lastFilterTgl = tgl;
      _syncBonFromSupabase().then(() => KASIR._renderFiltered(q, tgl));
    }
    this._renderFiltered(q, tgl);
  },

  _renderFiltered(q, tgl) {
    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    let filtered = [...allBon].reverse();

    if (q)   filtered = filtered.filter(b => (b.namaPelanggan || '').toLowerCase().includes(q));
    if (tgl) filtered = filtered.filter(b => b.waktu.slice(0, 10) === tgl);

    const el = document.getElementById('k-riwayat');
    if (!el) return;

    if (!filtered.length) {
      el.innerHTML = `
        <div class="empty" style="padding:24px 0">
          <div class="empty-ico">📭</div>
          <div>Tidak ada bon ditemukan.</div>
        </div>`;
      return;
    }

    el.innerHTML = filtered.map(b => `
      <div class="card" style="margin-bottom:8px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text)">${_escHtml(b.namaPelanggan)}</div>
            <div style="font-family:monospace;font-size:11px;color:var(--muted);margin-top:1px">${b.noFaktur}</div>
          </div>
          <div style="font-size:17px;font-weight:700;color:var(--green)">${fmt(b.total)}</div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">
          ${new Date(b.waktu).toLocaleDateString('id-ID')}
          ${new Date(b.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          &bull; ${b.items.map(i => _escHtml(i.nama)).join(', ').substring(0, 50)}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="badge ${b.metode === 'Tunai' ? 'badge-green' : b.metode === 'Transfer' ? 'badge-amber' : 'badge-red'}">
            ${b.metode}
          </span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="KASIR.lihatBon(${b.id})">🧾</button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="KASIR.editBon(${b.id})">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="KASIR.hapusBon(${b.id})">🗑️</button>
          </div>
        </div>
      </div>`).join('');
  },

  async buatBon() {
    const nama = (document.getElementById('k-nama')?.value || '').trim();
    const catatan = (document.getElementById('k-catatan')?.value || '').trim();

    if (!nama) {
      showToast('Isi nama pelanggan dulu!', 'error');
      document.getElementById('k-nama')?.focus();
      return;
    }
    if (!_items.length) {
      showToast('Belum ada barang yang ditambahkan.', 'error');
      return;
    }
    const valid = _items.filter(i => i.nama);
    if (!valid.length) {
      showToast('Isi nama barang terlebih dahulu.', 'error');
      return;
    }

    const total = valid.reduce((s, i) => s + i.harga * _parseQtyText(i.qty), 0);
    const totalQty = valid.reduce((s, i) => s + _parseQtyText(i.qty), 0);
    const noFaktur = generateNoFakturLocal();
    const waktu = new Date().toISOString();
    const tanggal = waktu.slice(0, 10);

    const bon = {
      id: Date.now(), noFaktur, waktu,
      namaPelanggan: nama, catatan,
      items: valid, total, metode: _metode
    };

    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    allBon.push(bon);
    localStorage.setItem('sj_bon', JSON.stringify(allBon));

    if (isConfigured && db) {
      try {
        const { error: e1 } = await db.from('tr_penjualan').insert({
          no_faktur: noFaktur,
          tanggal: tanggal,
          total_harga: total,
          total_qty: totalQty,
        });
        if (e1) throw e1;

        const { error: e2 } = await db.from('tr_penjualan_detail').insert(
          valid.map(i => ({
            no_faktur: noFaktur,
            kode_barang: i.kode_barang || null,
            nama_barang: i.nama,
            qty: _parseQtyText(i.qty),
            harga_satuan: i.harga,
            subtotal: i.harga * _parseQtyText(i.qty),
          }))
        );
        if (e2) throw e2;

        // Auto-catat hutang jika metode Hutang
        if (_metode === 'Hutang') {
          await db.from('tr_hutang').insert({
            no_faktur: noFaktur,
            nama_pelanggan: nama,
            jumlah: total,
            catatan: catatan || null,
            tanggal: tanggal,
            status: 'belum_lunas',
          });
        }

        showToast('Bon tersimpan & masuk laporan ✅', 'success');
      } catch (err) {
        showToast('Bon tersimpan lokal, gagal sync: ' + err.message, 'warning');
      }
    }

    _saveProductsToCache(valid);
    _renderProductCacheChips();
    _showStruk(bon);
    _renderRiwayat();
  },

  reset() {
    _items = [];
    _itemId = 0;
    _metode = 'Tunai';

    const nama = document.getElementById('k-nama');
    const catatan = document.getElementById('k-catatan');
    if (nama) nama.value = '';
    if (catatan) catatan.value = '';

    this.setMetode('Tunai');
    _renderItems();
    _renderSummary();

    const sw = document.getElementById('k-summary-wrap');
    if (sw) sw.style.display = 'none';

    const cols = document.getElementById('k-col-labels');
    if (cols) cols.style.display = 'none';

    const emp = document.getElementById('k-empty');
    if (emp) emp.style.display = 'block';

    const mc = document.getElementById('modal-container');
    if (mc) mc.innerHTML = '';
  },

  lihatBon(id) {
    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const bon = allBon.find(b => b.id === id);
    if (bon) _showStruk(bon, true);
  },

  editBon(id) {
    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const bon = allBon.find(b => b.id === id);
    if (!bon) return;

    const mc = document.getElementById('modal-container');
    mc.innerHTML = `
      <div class="modal-backdrop" onclick="KASIR._closeModal()">
        <div class="modal-sheet" onclick="event.stopPropagation()">
          <div class="drag-bar"></div>
          <div class="sheet-title">✏️ Edit Bon</div>
          <div class="field">
            <label>Ditujukan kepada</label>
            <input id="edit-nama" type="text" value="${_escHtml(bon.namaPelanggan)}" autocomplete="off">
          </div>
          <div class="field">
            <label>Catatan</label>
            <input id="edit-catatan" type="text" value="${_escHtml(bon.catatan || '')}" autocomplete="off">
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Cara Pembayaran</label>
            <select id="edit-metode">
              <option value="Tunai"    ${bon.metode === 'Tunai' ? 'selected' : ''}>Tunai</option>
              <option value="Transfer" ${bon.metode === 'Transfer' ? 'selected' : ''}>Transfer</option>
              <option value="Hutang"   ${bon.metode === 'Hutang' ? 'selected' : ''}>Hutang</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-outline" style="flex:1" onclick="KASIR._closeModal()">Batal</button>
            <button class="btn btn-primary" style="flex:2" onclick="KASIR._simpanEditBon(${id})">💾 Simpan</button>
          </div>
        </div>
      </div>`;
  },

  async _simpanEditBon(id) {
    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const idx = allBon.findIndex(b => b.id === id);
    if (idx < 0) return;

    const namaBaru = document.getElementById('edit-nama')?.value.trim();
    const catatanBaru = document.getElementById('edit-catatan')?.value.trim();
    const metodeBaru = document.getElementById('edit-metode')?.value;

    if (!namaBaru) {
      showToast('Nama pelanggan tidak boleh kosong', 'error');
      return;
    }

    allBon[idx].namaPelanggan = namaBaru;
    allBon[idx].catatan = catatanBaru;
    allBon[idx].metode = metodeBaru;
    localStorage.setItem('sj_bon', JSON.stringify(allBon));

    if (isConfigured && db) {
      try {
        await db.from('tr_penjualan')
          .update({ metode: metodeBaru })
          .eq('no_faktur', allBon[idx].noFaktur);
      } catch (err) {
        console.warn('Gagal update Supabase:', err.message);
      }
    }

    showToast('Bon berhasil diupdate ✅', 'success');
    this._closeModal();
    _renderRiwayat();
  },

  async hapusBon(id) {
    if (!confirm('Hapus bon ini? Data tidak bisa dikembalikan.')) return;

    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const bon = allBon.find(b => b.id === id);
    const newList = allBon.filter(b => b.id !== id);
    localStorage.setItem('sj_bon', JSON.stringify(newList));

    if (isConfigured && db && bon) {
      try {
        await db.from('tr_penjualan').delete().eq('no_faktur', bon.noFaktur);
        await db.from('tr_hutang').delete().eq('no_faktur', bon.noFaktur);
      } catch (err) {
        console.warn('Gagal hapus dari Supabase:', err.message);
      }
    }

    showToast('Bon berhasil dihapus', 'success');
    _renderRiwayat();
  },

  _closeModal() {
    const mc = document.getElementById('modal-container');
    if (mc) mc.innerHTML = '';
  },

  async _printBT(text) {
    try {
      if (!_bleChar) {
        document.getElementById('k-btext').textContent = 'Mencari printer...';
        const dev = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
          ]
        });
        const srv = await dev.gatt.connect();
        let chr;
        try {
          const svc = await srv.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
          chr = await svc.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
        } catch {
          const svc = await srv.getPrimaryService('e7810a71-73ae-499d-8c15-faa9aef0c3f2');
          chr = await svc.getCharacteristic('bef8d6c9-9c21-4c9e-b632-bd58c1009f9f');
        }
        _bleChar = chr;
      }

      const ESC = String.fromCharCode(27);
      const GS = String.fromCharCode(29);
      const full = ESC + '@' + ESC + 'a\x00' + text + '\n\n\n' + GS + 'V\x41\x03';
      const data = new TextEncoder().encode(full);

      for (let i = 0; i < data.length; i += 200) {
        await _bleChar.writeValue(data.slice(i, i + 200));
      }

      const dot = document.getElementById('k-bdot');
      if (dot) dot.className = 'ble-dot on';
      const txt = document.getElementById('k-btext');
      if (txt) txt.textContent = 'Cetak lagi ke printer';

      showToast('Struk berhasil dicetak!', 'success');
    } catch (e) {
      if (e.name === 'NotFoundError' || e.name === 'NotSupportedError') return;
      _bleChar = null;
      showToast('Gagal cetak: ' + e.message, 'error');
    }
  },
};

/* ===== STYLE KASIR (inject sekali) ===== */
if (!document.getElementById('kasir-styles')) {
  const style = document.createElement('style');
  style.id = 'kasir-styles';
  style.textContent = `
    .k-metode {
      padding: 12px 6px; border-radius: 13px;
      border: 1.5px solid var(--border); background: var(--white);
      font-size: 13px; font-weight: 600; cursor: pointer;
      text-align: center; color: var(--muted);
      font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.6;
      transition: all .15s;
    }
    .k-metode.active {
      border-color: var(--green); background: var(--green-light); color: var(--green);
    }
    .ble-dot { width:10px; height:10px; border-radius:50%; background:#d1d5db; flex-shrink:0; }
    .ble-dot.on { background:#22c55e; }
    .bottom-nav { grid-template-columns: repeat(6, 1fr) !important; }
    .nav-item   { font-size: 8.5px !important; }
    .nav-icon   { width: 19px !important; height: 19px !important; }
  `;
  document.head.appendChild(style);
}

/* ===== LOCAL HELPERS ===== */
function _escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Parse qty yang bisa berupa:
 *   - angka biasa  : "2", "0.5"
 *   - pecahan      : "1/2", "3/4"
 *   - teks campuran: "1 dus", "2 karton"  → ambil angka depannya
 */
function _parseQtyText(qtyVal) {
  const s = String(qtyVal || '1').trim();
  // pecahan: 1/2
  const frac = s.match(/^(\d+)\/(\d+)/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  // angka + teks: "2 dus" → 2
  const num = parseFloat(s);
  return isNaN(num) || num <= 0 ? 1 : num;
}