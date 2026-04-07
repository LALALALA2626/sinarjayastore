// pages/kasir.js — Kasir Manual (Bon Cepat)
import { fmt, fmtDateTime, showToast, buildStrukText, generateNoFakturLocal, similarity, normalizeProductName } from '../utils.js';
import { db, isConfigured } from '../supabase.js';

const SATUANS = ['pcs', 'kg', 'gr', 'bungkus', 'renceng', 'karton', 'lusin', 'pack', 'botol', 'liter', 'ikat', 'biji', 'sak', 'lbr', 'dus'];

let _items = [];
let _itemId = 0;
let _metode = 'Tunai';
let _bleChar = null;
let _masterBarang = []; // Cache ms_barang untuk autocomplete

/* ===== NORMALIZE NAMA PRODUK ===== */
function _normalizeNama(s) {
  return normalizeProductName(s);
}

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

  if (isConfigured && db) {
    const { data } = await db.from('ms_barang').select('kode_barang, nama_barang, harga_satuan');
    if (data) _masterBarang = data;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
  const bonHari = allBon.filter(b => b.waktu.slice(0, 10) === todayKey);
  const revHari = bonHari.reduce((s, b) => s + b.total, 0);

  container.innerHTML = `
    <div class="gap-12 glass-container">

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

      <div class="card glass-card">
        <div class="sec-lbl">Informasi Bon</div>
        <div class="field">
          <label>Ditujukan kepada *</label>
          <input id="k-nama" type="text" placeholder="Nama pelanggan..."
            autocomplete="off" autocorrect="off" autocapitalize="words" class="glass-input">
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Catatan (opsional)</label>
          <input id="k-catatan" type="text"
            placeholder="Mis: hutang, titip barang..." autocomplete="off" class="glass-input">
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="sec-lbl" style="margin:0">Daftar Barang</div>
          <div style="display:flex; gap: 6px;">
             <button class="btn btn-secondary btn-sm" onclick="KASIR.startScanner()" style="background:#fff; border-color:#e5e7eb; color:#1a1a1a;">📷 Scan</button>
             <button class="btn btn-secondary btn-sm" onclick="KASIR.addItem()">+ Tambah</button>
          </div>
        </div>
        <div class="card glass-card" style="padding:12px 14px;position:relative">
          <div id="k-autocomplete-dropdown" class="glass-dropdown"></div>
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
          <div id="k-add-btn-wrap" style="display:none;margin-top:10px;text-align:center">
             <button class="btn btn-secondary btn-sm" onclick="KASIR.addItem()" style="width:100%;font-size:13px;padding:10px;border-radius:10px;">+ Tambah Barang Lagi</button>
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
            ${['1/4', '1/3', '1/2', '2/3', '3/4', '1.5', '2', '3', '5', '10'].map(q => `
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
        <div class="summary-box glass-card">
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
          <button class="k-metode active glass-btn" id="km-Tunai"    onclick="KASIR.setMetode('Tunai')">💵<br>Tunai</button>
          <button class="k-metode glass-btn"        id="km-Transfer" onclick="KASIR.setMetode('Transfer')">📲<br>Transfer</button>
          <button class="k-metode glass-btn"        id="km-Hutang"   onclick="KASIR.setMetode('Hutang')">📋<br>Hutang</button>
        </div>
      </div>

      <button class="btn btn-primary glass-btn-primary mt-12" onclick="KASIR.buatBon()">✅ Buat Bon &amp; Cetak</button>
      <button class="btn btn-outline glass-btn-outline"  onclick="KASIR.reset()">🔄 Bersihkan &amp; Mulai Baru</button>

      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="sec-lbl" style="margin:0">Riwayat Bon</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="KASIR.cetakUlangTerakhir()" style="font-size:12px;padding:6px 12px">🔁 Terakhir</button>
            <button class="btn btn-danger btn-sm" onclick="KASIR.hapusBonHariIni()" style="font-size:12px;padding:6px 12px">🗑️ Hapus</button>
          </div>
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
    if (document.getElementById('k-add-btn-wrap')) document.getElementById('k-add-btn-wrap').style.display = 'none';
    return;
  }

  if (emp) emp.style.display = 'none';
  if (sw) sw.style.display = 'block';
  if (cols) cols.style.display = 'grid';
  if (document.getElementById('k-add-btn-wrap')) document.getElementById('k-add-btn-wrap').style.display = 'block';

  // Hapus datalist lama, kita pakai custom dropdown
  el.innerHTML = _items.map(it => `
    <div data-item-id="${it.id}" style="display:grid;grid-template-columns:1fr 72px 52px 66px 30px;gap:5px;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">
      <input class="ii k-nama-inp" placeholder="Nama barang"
        value="${_escHtml(it.nama)}"
        oninput="KASIR.updItem(${it.id},'nama',this.value); KASIR.searchProduct(this, ${it.id})"
        onfocus="KASIR.searchProduct(this, ${it.id})"
        onblur="setTimeout(() => KASIR.hideDropdown(), 200)"
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
  const el = document.getElementById('k-produk-chips');
  if (!wrap || !el) return;

  const cache = _loadProductCache();
  if (!cache.length) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'block';
  el.innerHTML = cache.slice(0, 24).map((p, idx) => {
    const isFav = (p.hitungPakai || 0) > 5;
    return `<button style="padding:5px 12px;border-radius:20px;
      border:1.5px solid ${isFav ? '#fcd34d' : '#d1fae5'};
      background:${isFav ? '#fffbeb' : '#f0fdf4'};
      font-size:12px;font-weight:600;cursor:pointer;
      color:${isFav ? '#92400e' : '#065f46'};
      font-family:'Plus Jakarta Sans',sans-serif;
      display:inline-flex;align-items:center;gap:5px;white-space:nowrap"
      onclick="KASIR.addFromCache(${idx})">
      ${isFav ? '<span style="font-size:10px">⭐</span>' : ''}
      ${_escHtml(p.nama)}
      <span style="font-weight:400;opacity:.65;font-size:11px">${fmt(p.harga)}</span>
    </button>`;
  }).join('');
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
  const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
  const bonHari = allBon.filter(b => b.waktu.slice(0, 10) === todayKey);
  const revTotal = bonHari.reduce((s, b) => s + b.total, 0);
  const cntEl = document.getElementById('k-bon-count');
  const revEl = document.getElementById('k-rev');
  if (cntEl) cntEl.textContent = bonHari.length + ' bon';
  if (revEl) revEl.textContent = fmt(revTotal);
  KASIR.filterRiwayat();
}

/* ===== SHOW STRUK MODAL ===== */
function _showStruk(bon, isView = false) {
  const struktxt = buildStrukText({
    noFaktur: bon.noFaktur,
    tanggal: bon.waktu,        // kirim ISO string — shortDate() di utils.js yang format
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

        <!-- Preview Bon seperti kertas struk -->
        <div style="text-align:center; width:100%; overflow-x:auto; margin-bottom: 14px;">
          <div style="
            display: inline-block;
            font-family: 'Courier New', Courier, monospace;
            background: #fff;
            border-radius: 10px;
            padding: 18px 16px;
            font-size: 13.5px;
            line-height: 1.8;
            color: #1a1a1a;
            border: 1px solid #e5e7eb;
            box-shadow: 0 2px 8px rgba(0,0,0,.06);
            letter-spacing: 0.02em;
            text-align: center;
          ">
            <img src="logo.jpg" alt="Logo Sinar Jaya" style="display: block; margin: 0 auto 10px auto; width: 60px; height: 60px; object-fit: contain; filter: grayscale(100%);">
            <div style="white-space: pre; text-align: left; margin: 0 auto; display: inline-block;">${struktxt}</div>
          </div>
        </div>

        <!-- Tombol Cetak Bluetooth -->
        ${navigator.bluetooth ? `
        <button style="
          display:flex;align-items:center;gap:10px;width:100%;
          padding:14px 16px;background:#f0fdf4;
          border:1.5px solid #bbf7d0;border-radius:13px;
          font-size:14px;font-weight:600;cursor:pointer;
          color:#166534;font-family:'Plus Jakarta Sans',sans-serif;
          margin-bottom:10px"
          onclick="KASIR._printBT(\`${safeTxt}\`)">
          <div class="ble-dot${_bleChar ? ' on' : ''}" id="k-bdot"></div>
          <span id="k-btext">${_bleChar ? 'Cetak lagi ke printer' : 'Sambungkan printer Bluetooth'}</span>
        </button>` : `
        <div style="
          display:flex;align-items:center;gap:10px;width:100%;
          padding:12px 16px;background:#fefce8;
          border:1.5px solid #fde68a;border-radius:13px;
          font-size:13px;font-weight:500;
          color:#92400e;font-family:'Plus Jakarta Sans',sans-serif;
          margin-bottom:10px">
          ⚠️ Bluetooth tidak tersedia. Buka via HTTPS atau gunakan localhost.
        </div>`}
        
        <!-- Tombol Kirim WhatsApp -->
        <button style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
          padding:14px 16px;background:#eff6ff; border:1.5px solid #bfdbfe;border-radius:13px;
          font-size:14px;font-weight:600;cursor:pointer; color:#1e40af;font-family:'Plus Jakarta Sans',sans-serif;
          margin-bottom:10px"
          onclick="KASIR._shareWA(\`${safeTxt}\`)">
          💬 Bagikan Bon ke WhatsApp
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
  const tgl = (tglEl && tglEl.value) || new Date().toISOString().slice(0, 10);

  try {
    // Ambil header bon (termasuk nama_pelanggan, catatan, metode)
    const { data: headers } = await db
      .from('tr_penjualan')
      .select('no_faktur, tanggal, total_harga, created_at, metode, nama_pelanggan, catatan')
      .eq('tanggal', tgl)
      .order('created_at', { ascending: false });

    if (!headers || !headers.length) return;

    // Ambil detail semua bon sekaligus
    const fakturList = headers.map(h => h.no_faktur);
    const { data: details } = await db
      .from('tr_penjualan_detail')
      .select('no_faktur, nama_barang, kode_barang, qty, harga_satuan, subtotal, satuan')
      .in('no_faktur', fakturList);

    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const existingFaktur = new Set(allBon.map(b => b.noFaktur));
    let changed = false;

    for (const h of headers) {
      if (existingFaktur.has(h.no_faktur)) continue; // sudah ada

      const itemDetails = (details || []).filter(d => d.no_faktur === h.no_faktur);
      const bon = {
        id: Date.now() + Math.random(), // pseudo-id unik
        noFaktur: h.no_faktur,
        waktu: h.created_at || (tgl + 'T00:00:00.000Z'),
        namaPelanggan: h.nama_pelanggan || '(tidak diketahui)',
        catatan: h.catatan || '',
        metode: h.metode || 'Tunai',
        total: h.total_harga,
        items: itemDetails.map(d => ({
          nama: d.nama_barang,
          harga: d.harga_satuan,
          qty: String(d.qty),
          satuan: d.satuan || 'pcs',
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
    const existing = cacheMap[key];
    cacheMap[key] = {
      nama: i.nama.trim(),
      harga: i.harga || 0,
      satuan: i.satuan || 'pcs',
      kode_barang: i.kode_barang || (existing ? existing.kode_barang : null),
      hitungPakai: (existing ? (existing.hitungPakai || 0) : 0) + 1,
      lastUsed: new Date().toISOString(),
    };
  });

  // Urutkan: paling sering dipakai di depan, tiebreak lastUsed. Simpan max 150
  const sorted = Object.values(cacheMap)
    .sort((a, b) => {
      const diff = (b.hitungPakai || 0) - (a.hitungPakai || 0);
      return diff !== 0 ? diff : new Date(b.lastUsed) - new Date(a.lastUsed);
    })
    .slice(0, 150);
  localStorage.setItem(_CACHE_KEY, JSON.stringify(sorted));
}

/* ===== GLOBAL KASIR OBJECT ===== */
window.KASIR = {
  addItem() {
    _items.push({ id: ++_itemId, kode_barang: null, nama: '', harga: 0, qty: 1, satuan: 'pcs' });
    _renderItems();
    setTimeout(() => {
      const inputs = document.querySelectorAll('.k-nama-inp');
      if (inputs.length) {
        inputs[inputs.length - 1].focus({ preventScroll: true });
        inputs[inputs.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
        if (inputs.length) inputs[inputs.length - 1].focus({ preventScroll: true });
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

  searchProduct(inputEl, id) {
    const val = inputEl.value.trim();
    if (!val) { KASIR.hideDropdown(); return; }
    const valLower = val.toLowerCase();

    const dropdown = document.getElementById('k-autocomplete-dropdown');

    // Build candidate list from BOTH sources
    const cache = _loadProductCache();
    const masterNameSet = new Set(_masterBarang.map(b => b.nama_barang.toLowerCase()));
    const cacheMap = {};
    cache.forEach(p => { cacheMap[p.nama.toLowerCase()] = p; });

    const candidates = [];
    // Master source
    _masterBarang.forEach(b => {
      const cp = cacheMap[b.nama_barang.toLowerCase()];
      candidates.push({
        kode: b.kode_barang,
        nama: b.nama_barang,
        harga: cp ? cp.harga : b.harga_satuan, // prefer cache price (last used)
        satuan: cp ? (cp.satuan || 'pcs') : 'pcs',
        hitungPakai: cp ? (cp.hitungPakai || 0) : 0,
        isMaster: true,
      });
    });
    // Cache-only (not in master)
    cache.forEach(p => {
      if (!masterNameSet.has(p.nama.toLowerCase())) {
        candidates.push({
          kode: p.kode_barang || null,
          nama: p.nama,
          harga: p.harga,
          satuan: p.satuan || 'pcs',
          hitungPakai: p.hitungPakai || 0,
          isMaster: false,
        });
      }
    });

    // Score each candidate
    function score(c) {
      const n = c.nama.toLowerCase();
      const abbrev = n.split(/\s+/).filter(Boolean).map(w => w[0]).join('');
      if (n === valLower) return 100;
      if (abbrev === valLower) return 82;
      if (abbrev.startsWith(valLower)) return 72;
      if (n.startsWith(valLower)) return 68;
      if (n.includes(valLower)) return 60;
      const sim = similarity(c.nama, val);
      if (sim > 0.6) return Math.round(sim * 55);
      return 0;
    }

    const results = candidates
      .map(c => ({ ...c, _score: score(c) }))
      .filter(c => c._score > 0)
      .sort((a, b) => b._score !== a._score ? b._score - a._score : b.hitungPakai - a.hitungPakai)
      .slice(0, 8);

    if (!results.length) { KASIR.hideDropdown(); return; }

    const rect = inputEl.getBoundingClientRect();
    const cardEl = dropdown.parentElement;
    const cardRect = cardEl ? cardEl.getBoundingClientRect() : { top: 0, left: 0 };
    dropdown.style.top  = (rect.bottom - cardRect.top + 5) + 'px';
    dropdown.style.left = (rect.left - cardRect.left) + 'px';
    dropdown.style.width = Math.max(rect.width, 240) + 'px';
    dropdown.style.display = 'block';

    dropdown.innerHTML = results.map(b => {
      const isFav = b.hitungPakai > 5;
      return `
      <div class="dd-item" onclick="KASIR.selectProduct(${id},'${_escAttr(b.kode||'')}','${_escAttr(b.nama)}',${b.harga},'${_escAttr(b.satuan||'pcs')}')">
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;flex:1;min-width:0">
          <div class="dd-nama" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escHtml(b.nama)}</div>
          ${b.isMaster ? '<span class="badge badge-master" style="font-size:9px;padding:1px 5px;flex-shrink:0">Master</span>' : ''}
          ${isFav ? '<span class="badge badge-fav" style="font-size:9px;padding:1px 5px;flex-shrink:0">⭐ Favorit</span>' : ''}
        </div>
        <div class="dd-harga" style="flex-shrink:0;margin-left:8px">${fmt(b.harga)}</div>
      </div>`;
    }).join('');
  },

  selectProduct(id, kode, nama, harga, satuan) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    item.kode_barang = kode || null;
    item.nama = nama;
    item.harga = harga;
    if (satuan) item.satuan = satuan;

    KASIR.hideDropdown();
    _renderItems();

    setTimeout(() => {
      const row = document.querySelector(`[data-item-id="${id}"]`);
      if (row) {
        const qtyEl = row.querySelectorAll('.ii')[2];
        if (qtyEl) qtyEl.focus();
      }
    }, 50);
  },

  hideDropdown() {
    const d = document.getElementById('k-autocomplete-dropdown');
    if (d) d.style.display = 'none';
  },

  autoFill(id, nama) {
    // Dipanggil dari cache jika fallback datalist, tapi sudah pakai searchProduct.
    // Menjaga kompatibilitas.
  },

  async hapusBonHariIni() {
    const todayKey = new Date().toISOString().slice(0, 10);
    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
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
    const q = (document.getElementById('k-search')?.value || '').toLowerCase();
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

    if (q) filtered = filtered.filter(b => (b.namaPelanggan || '').toLowerCase().includes(q));
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
    // Selalu tampilkan modal untuk semua metode, agar DP & nominal tercatat dengan baik
    KASIR._showBayarModal(total, nama, catatan, valid);
  },

  _showBayarModal(total, nama, catatan, valid) {
    const isHutang = _metode === 'Hutang';
    const title = isHutang ? '📋 Pembayaran Hutang (Bisa DP)' : (_metode === 'Transfer' ? '📲 Pembayaran Transfer' : '💵 Pembayaran Tunai');

    // Hitung tombol pecahan uang cerdas (Smart Cash Chips)
    const smarts = [
      Math.ceil(total / 5000) * 5000,
      Math.ceil(total / 10000) * 10000,
      Math.ceil(total / 20000) * 20000,
      Math.ceil(total / 50000) * 50000,
      Math.ceil(total / 100000) * 100000,
    ].filter(x => x > total);
    // filter unik & urutkan, ambil maks 3
    const smartM = [...new Set(smarts)].sort((a, b) => a - b).slice(0, 3);
    const smartHTML = smartM.map(val =>
      `<button class="btn btn-secondary btn-sm" onclick="document.getElementById('k-bayar-inp').value=${val}; KASIR._calcKembalian(${total})">${fmt(val).replace('Rp ', '')}</button>`
    ).join('');

    const mc = document.getElementById('modal-container');
    mc.innerHTML = `
      <div class="modal-backdrop" id="k-modal" onclick="KASIR._closeModal()">
        <div class="modal-sheet" onclick="event.stopPropagation()">
          <div class="drag-bar"></div>
          <div class="sheet-title" style="text-align:center">${title}</div>
          <div style="text-align:center; margin-bottom: 24px;">
            <div style="font-size:13px; color:var(--muted)">Total Belanja</div>
            <div style="font-size:36px; font-weight:800; color:var(--green)">${fmt(total)}</div>
          </div>
          <div class="field">
            <label style="text-align:center; font-size: 14px;">${isHutang ? 'Nominal DP / Dibayar Awal (Kosongkan jika 0)' : 'Nominal Diterima (Rp)'}</label>
            <input id="k-bayar-inp" type="number" inputmode="numeric" placeholder="${isHutang ? '0' : total}"
              oninput="KASIR._calcKembalian(${total})" style="font-size: 24px; font-weight: 700; text-align:center; padding: 16px;">
          </div>
          <div style="display:flex; justify-content:center; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;">
            ${isHutang ? `<button class="btn btn-secondary btn-sm" onclick="document.getElementById('k-bayar-inp').value=0; KASIR._calcKembalian(${total})">Tanpa DP (0)</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('k-bayar-inp').value=${total}; KASIR._calcKembalian(${total})">${isHutang ? 'Lunas' : 'Pas'}</button>
            ${smartHTML}
          </div>
          <div style="padding: 18px; background: var(--green-light); border-radius: var(--radius-sm); margin-bottom: 24px; text-align: center;">
            <div id="k-kembalian-lbl" style="font-size:14px; color:var(--green-dark); font-weight: 700;">${isHutang ? 'Sisa Hutang' : 'Kembalian'}</div>
            <div id="k-kembalian-val" style="font-size:32px; font-weight:800; color:var(--green-dark)">${isHutang ? fmt(total) : 'Rp 0'}</div>
          </div>
          <button class="btn btn-primary" onclick="KASIR._submitBayar(${total}, '${_escHtml(nama)}', '${_escHtml(catatan)}')">✅ Simpan & Cetak Bon</button>
        </div>
      </div>
    `;
    setTimeout(() => { document.getElementById('k-bayar-inp')?.focus(); }, 100);
  },

  _calcKembalian(total) {
    const byrStr = document.getElementById('k-bayar-inp').value;
    const byr = byrStr ? parseFloat(byrStr) : 0;
    const k = byr - total;
    const el = document.getElementById('k-kembalian-val');
    const lbl = document.getElementById('k-kembalian-lbl');

    if (_metode === 'Hutang') {
      if (k < 0) {
        lbl.textContent = 'Sisa Hutang';
        el.textContent = fmt(Math.abs(k));
        el.style.color = 'var(--red)';
      } else {
        lbl.textContent = 'Kembalian';
        el.textContent = fmt(k);
        el.style.color = 'var(--green-dark)';
      }
    } else {
      if (k < 0) {
        lbl.textContent = 'Kurang Bayar';
        el.textContent = fmt(Math.abs(k));
        el.style.color = 'var(--red)';
      } else {
        lbl.textContent = 'Kembalian';
        el.textContent = fmt(k);
        el.style.color = 'var(--green-dark)';
      }
    }
  },

  _submitBayar(total, nama, catatan) {
    const valid = _items.filter(i => i.nama);
    const byrStr = document.getElementById('k-bayar-inp').value;
    // Jika tidak diisi & metode bukan hutang, anggap bayar pas (total). 
    // Jika Hutang, default DP adalah 0.
    const defaultByr = _metode === 'Hutang' ? 0 : total;
    const byr = byrStr ? parseFloat(byrStr) : defaultByr;

    if (_metode !== 'Hutang' && byr < total) {
      showToast('Uang kurang!', 'error');
      return;
    }

    KASIR._closeModal();
    // Jika Hutang, selisih kurang = Sisa Hutang. Kalau lunas = Kembalian 0
    const kembali = (_metode === 'Hutang' && byr < total) ? Math.abs(total - byr) : (byr - total);
    KASIR._prosesSimpanBon(total, nama, catatan, valid, byr, kembali);
  },

  async _prosesSimpanBon(total, nama, catatan, valid, bayar, kembali) {
    const totalQty = valid.reduce((s, i) => s + _parseQtyText(i.qty), 0);
    let noFaktur = generateNoFakturLocal();
    const waktu = new Date().toISOString();
    const tanggal = waktu.slice(0, 10);

    const bon = {
      id: Date.now(), noFaktur, waktu,
      namaPelanggan: nama, catatan,
      items: valid, total, metode: _metode,
      bayar, kembali
    };

    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    allBon.push(bon);
    localStorage.setItem('sj_bon', JSON.stringify(allBon));

    if (isConfigured && db) {
      try {
        // 1. Simpan header bon — retry max 3x jika duplicate key (23505)
        let e1 = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 100));
            noFaktur = generateNoFakturLocal();
          }
          const headerPayload = {
            no_faktur: noFaktur,
            tanggal: tanggal,
            total_harga: total,
            total_qty: totalQty,
            nama_pelanggan: nama,
            catatan: catatan || null,
            metode: _metode,
          };
          const { error } = await db.from('tr_penjualan').insert(headerPayload);
          if (!error) { e1 = null; break; }
          if (error.code === '23505') { e1 = error; continue; } // duplicate — retry
          if (error.message && error.message.includes('does not exist')) {
            // Schema fallback
            const { error: err1 } = await db.from('tr_penjualan').insert({
              no_faktur: noFaktur, tanggal, total_harga: total, total_qty: totalQty
            });
            e1 = err1; break;
          }
          e1 = error; break;
        }

        // Update noFaktur in localStorage if it changed on retry
        if (bon.noFaktur !== noFaktur) {
          const stored = JSON.parse(localStorage.getItem('sj_bon') || '[]');
          const idx = stored.findIndex(b => b.noFaktur === bon.noFaktur);
          if (idx >= 0) { stored[idx].noFaktur = noFaktur; localStorage.setItem('sj_bon', JSON.stringify(stored)); }
          bon.noFaktur = noFaktur;
        }

        if (e1) throw e1;

        // 2. Smart sync ke ms_barang — hanya masuk jika benar-benar baru (no fuzzy match > 80%)
        for (const i of valid) {
          if (!i.kode_barang) {
            const typedVal = i.nama.toLowerCase().replace(/\s+/g, '');
            const matchMaster = _masterBarang.find(mb => {
              const lowerMB = mb.nama_barang.toLowerCase();
              if (lowerMB === i.nama.toLowerCase()) return true;
              if (similarity(mb.nama_barang, i.nama) > 0.80) return true;
              const abbrev = lowerMB.split(/\s+/).filter(Boolean).map(w => w[0]).join('');
              if (abbrev === i.nama.toLowerCase() || abbrev === typedVal) return true;
              return false;
            });
            if (matchMaster) {
              if (i.nama.toLowerCase() !== matchMaster.nama_barang.toLowerCase()) {
                showToast(`Produk dikenali sebagai "${matchMaster.nama_barang}"`, 'info');
              }
              i.kode_barang = matchMaster.kode_barang;
              i.nama = matchMaster.nama_barang;
            } else {
              const normalizedName = _normalizeNama(i.nama);
              i.nama = normalizedName;
              const newKode = _generateKode(normalizedName);
              i.kode_barang = newKode;
              await db.from('ms_barang').insert({
                kode_barang: newKode,
                nama_barang: normalizedName,
                harga_satuan: i.harga
              });
              _masterBarang.push({ kode_barang: newKode, nama_barang: normalizedName, harga_satuan: i.harga });
            }
          }
        }

        // 3. Simpan detail
        let { error: e2 } = await db.from('tr_penjualan_detail').insert(
          valid.map(i => ({
            no_faktur: noFaktur,
            kode_barang: i.kode_barang || null,
            nama_barang: i.nama,
            qty: _parseQtyText(i.qty),
            harga_satuan: i.harga,
            subtotal: i.harga * _parseQtyText(i.qty),
            satuan: i.satuan || 'pcs',
          }))
        );

        if (e2 && e2.message && e2.message.includes('does not exist')) {
          const { error: err2 } = await db.from('tr_penjualan_detail').insert(
            valid.map(i => ({
              no_faktur: noFaktur,
              kode_barang: i.kode_barang || null,
              nama_barang: i.nama,
              qty: _parseQtyText(i.qty),
              harga_satuan: i.harga,
              subtotal: i.harga * _parseQtyText(i.qty)
            }))
          );
          e2 = err2;
        }

        if (e2) throw e2;

        // Auto-catat hutang jika metode Hutang
        if (_metode === 'Hutang') {
          const sisaHutang = (bayar < total) ? Math.abs(total - bayar) : 0;
          if (sisaHutang > 0) {
            await db.from('tr_hutang').insert({
              no_faktur: noFaktur,
              nama_pelanggan: nama,
              jumlah: sisaHutang,
              catatan: (catatan ? catatan + ' ' : '') + `(Sisa hasil DP Rp ${fmtNum(bayar)})`,
              tanggal: tanggal,
              status: 'belum_lunas',
            });
          }
        }

        showToast('Bon tersimpan & masuk laporan ✅', 'success');
      } catch (err) {
        showToast('Bon tersimpan lokal, gagal sync: ' + err.message, 'warning');
      }
    }

    _saveProductsToCache(valid);
    _renderProductCacheChips();
    _showConfetti();
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

    // Simpan ke cache untuk edit interaktif
    window._editItemsCache = JSON.parse(JSON.stringify(bon.items));

    const mc = document.getElementById('modal-container');
    mc.innerHTML = `
      <div class="modal-backdrop" onclick="KASIR._closeModal()">
        <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:90vh;overflow-y:auto;padding-bottom:50px;">
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
          <div class="field">
            <label>Cara Pembayaran</label>
            <select id="edit-metode">
              <option value="Tunai"    ${bon.metode === 'Tunai' ? 'selected' : ''}>Tunai</option>
              <option value="Transfer" ${bon.metode === 'Transfer' ? 'selected' : ''}>Transfer</option>
              <option value="Hutang"   ${bon.metode === 'Hutang' ? 'selected' : ''}>Hutang</option>
            </select>
          </div>

          <div style="margin-bottom:6px">
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;
              letter-spacing:.06em;margin-bottom:8px">✏️ Daftar Barang</div>
            <div style="overflow-x:auto;border-radius:10px;border:1.5px solid var(--border)">
              <table style="width:100%;border-collapse:collapse;min-width:320px;">
                <thead>
                  <tr style="background:#f9fafb">
                    <th style="padding:7px 4px 6px;font-size:10px;font-weight:700;color:var(--muted);
                      text-transform:uppercase;letter-spacing:.04em;text-align:left">Barang</th>
                    <th style="padding:7px 4px 6px;font-size:10px;font-weight:700;color:var(--muted);
                      text-transform:uppercase;letter-spacing:.04em;text-align:center">Qty</th>
                    <th style="padding:7px 4px 6px;font-size:10px;font-weight:700;color:var(--muted);
                      text-transform:uppercase;letter-spacing:.04em;text-align:right">Harga</th>
                    <th style="padding:7px 4px 6px;font-size:10px;font-weight:700;color:var(--muted);
                      text-transform:uppercase;letter-spacing:.04em;text-align:center">Satuan</th>
                    <th style="padding:7px 4px 6px;width:30px;"></th>
                  </tr>
                </thead>
                <tbody id="edit-items-body"></tbody>
              </table>
            </div>
            
            <div style="margin-top:8px;">
              <button class="btn btn-secondary btn-sm" onclick="KASIR._addEditItem()" style="padding:6px 12px;font-size:12px;">+ Tambah Barang</button>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;
              margin-top:10px;padding:10px 12px;background:#f0fdf4;
              border-radius:10px;border:1.5px solid #d1fae5">
              <span style="font-size:13px;font-weight:600;color:#065f46">Total Baru</span>
              <span id="edit-total-val" style="font-size:16px;font-weight:700;color:var(--green)">${fmt(bon.total)}</span>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-top:20px">
            <button class="btn btn-outline" style="flex:1" onclick="KASIR._closeModal()">Batal</button>
            <button class="btn btn-primary" style="flex:2" onclick="KASIR._simpanEditBon(${id})">💾 Simpan Perubahan</button>
          </div>
        </div>
      </div>`;

    KASIR._renderEditItemsTable();
  },

  _renderEditItemsTable() {
    const items = window._editItemsCache || [];
    const SATUANS = ['pcs', 'kg', 'gr', 'bungkus', 'renceng', 'karton', 'lusin', 'pack', 'botol', 'liter', 'ikat', 'biji', 'sak', 'lbr', 'dus'];

    const rows = items.map((it, idx) => `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:6px 4px;">
           <input type="text" class="ii edit-item-nama" value="${_escHtml(it.nama)}" placeholder="Nama" 
             oninput="KASIR._updateEditItem(${idx}, 'nama', this.value)" style="width:100%;font-size:12px;padding:6px;min-width:100px;">
        </td>
        <td style="padding:6px 4px;">
          <input type="text" class="ii edit-item-qty" value="${_escHtml(String(it.qty))}" inputmode="decimal"
            oninput="KASIR._updateEditItem(${idx}, 'qty', this.value)" style="width:48px;text-align:center;font-size:12px;padding:6px;">
        </td>
        <td style="padding:6px 4px;">
          <input type="number" class="ii edit-item-harga" value="${it.harga || 0}" inputmode="numeric"
            oninput="KASIR._updateEditItem(${idx}, 'harga', this.value)" style="width:75px;text-align:right;font-size:12px;padding:6px;">
        </td>
        <td style="padding:6px 4px;">
          <select class="ii edit-item-satuan" onchange="KASIR._updateEditItem(${idx}, 'satuan', this.value)" style="padding:6px 4px;font-size:11px;width:100%;min-width:65px;">
            ${SATUANS.map(s => `<option value="${s}" ${it.satuan === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td style="padding:6px 4px;text-align:center;">
          <button class="btn btn-danger btn-icon btn-sm" onclick="KASIR._removeEditItem(${idx})" style="padding:4px;width:24px;height:24px;">✕</button>
        </td>
      </tr>
    `).join('');

    const tbody = document.getElementById('edit-items-body');
    if (tbody) tbody.innerHTML = rows;
    KASIR._recalcEditTotal();
  },

  _updateEditItem(idx, field, val) {
    if (!window._editItemsCache[idx]) return;
    if (field === 'harga') window._editItemsCache[idx][field] = parseFloat(val) || 0;
    else window._editItemsCache[idx][field] = val;
    if (field === 'qty' || field === 'harga') KASIR._recalcEditTotal();
  },

  _removeEditItem(idx) {
    window._editItemsCache.splice(idx, 1);
    KASIR._renderEditItemsTable();
  },

  _addEditItem() {
    window._editItemsCache.push({ nama: '', qty: '1', harga: 0, satuan: 'pcs' });
    KASIR._renderEditItemsTable();
  },

  _recalcEditTotal() {
    let total = 0;
    (window._editItemsCache || []).forEach(it => {
      const q = typeof it.qty === 'string' ? _parseQtyText(it.qty) : parseFloat(it.qty) || 0;
      total += q * (parseFloat(it.harga) || 0);
    });
    const el = document.getElementById('edit-total-val');
    if (el) el.textContent = fmt(total);
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

    // Bersihkan yang tidak ada nama
    const updatedItems = (window._editItemsCache || []).filter(i => i.nama && i.nama.trim() !== '');
    if (!updatedItems.length) {
      showToast('Barang tidak boleh kosong semua', 'error');
      return;
    }

    const totalBaru = updatedItems.reduce(
      (s, it) => s + (parseFloat(it.harga) || 0) * _parseQtyText(it.qty), 0
    );

    allBon[idx].namaPelanggan = namaBaru;
    allBon[idx].catatan = catatanBaru;
    allBon[idx].metode = metodeBaru;
    allBon[idx].items = updatedItems;
    allBon[idx].total = totalBaru;
    localStorage.setItem('sj_bon', JSON.stringify(allBon));

    if (isConfigured && db) {
      try {
        const noFaktur = allBon[idx].noFaktur;

        // Update header: total, metode, nama, catatan
        let { error: eUpdate } = await db.from('tr_penjualan').update({
          metode: metodeBaru,
          nama_pelanggan: namaBaru,
          catatan: catatanBaru || null,
          total_harga: totalBaru,
        }).eq('no_faktur', noFaktur);

        if (eUpdate && eUpdate.message && eUpdate.message.includes('does not exist')) {
          await db.from('tr_penjualan').update({ total_harga: totalBaru }).eq('no_faktur', noFaktur);
        }

        // Update detail: Supaya aman untuk hapus/tambah baris, kita delete lama & insert yang baru
        await db.from('tr_penjualan_detail').delete().eq('no_faktur', noFaktur);

        let { error: eDtl } = await db.from('tr_penjualan_detail').insert(updatedItems.map(it => {
          const subtotal = (parseFloat(it.harga) || 0) * _parseQtyText(it.qty);
          return {
            no_faktur: noFaktur,
            kode_barang: it.kode_barang || null,
            nama_barang: it.nama,
            qty: _parseQtyText(it.qty),
            harga_satuan: parseFloat(it.harga) || 0,
            subtotal: subtotal,
            satuan: it.satuan || 'pcs',
          };
        }));

        if (eDtl && eDtl.message && eDtl.message.includes('does not exist')) {
          await db.from('tr_penjualan_detail').insert(updatedItems.map(it => {
            const subtotal = (parseFloat(it.harga) || 0) * _parseQtyText(it.qty);
            return {
              no_faktur: noFaktur,
              kode_barang: it.kode_barang || null,
              nama_barang: it.nama,
              qty: _parseQtyText(it.qty),
              harga_satuan: parseFloat(it.harga) || 0,
              subtotal: subtotal
            };
          }));
        }
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

  cetakUlangTerakhir() {
    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    if (!allBon.length) { showToast('Belum ada bon tersimpan', 'info'); return; }
    const lastBon = allBon[allBon.length - 1];
    _showStruk(lastBon, true);
  },

  _closeModal() {
    const mc = document.getElementById('modal-container');
    if (mc) mc.innerHTML = '';
  },

  _shareWA(text) {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  },

  startScanner() {
    const mc = document.getElementById('modal-container');
    mc.innerHTML = `
      <div class="modal-backdrop" style="background: rgba(0,0,0,0.9);">
        <div class="modal-sheet" style="padding:16px;text-align:center;max-width:400px;margin:auto;">
           <h3 style="margin-bottom:16px;font-size:16px;">📷 Arahkan Kamera ke Barcode</h3>
           <div id="reader" style="width:100%; max-width:400px; margin: 0 auto; border-radius: 12px; overflow:hidden; border:2px solid var(--green);"></div>
           <button class="btn btn-outline" style="margin-top:20px; width:100%; border-color:#e5e7eb" onclick="KASIR.stopScanner()">Tutup Kamera</button>
        </div>
      </div>
    `;

    try {
      if (!window.Html5QrcodeScanner) {
        showToast('Modul Scanner masih dimuat...', 'warning');
        KASIR.stopScanner();
        return;
      }
      const scanner = new window.Html5QrcodeScanner('reader', {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0,
      }, false);

      this._scanner = scanner;
      scanner.render((result) => {
        KASIR.stopScanner();
        // Bunyi beep sukses
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator(); osc.connect(ctx.destination);
          osc.frequency.value = 800; osc.start(); setTimeout(() => osc.stop(), 100);
        } catch (e) { }

        // Cari di MS Barang
        const found = _masterBarang.find(m => (m.kode_barang || '').toLowerCase() === result.toLowerCase());
        if (found) {
          // Tambahkan ke keranjang
          KASIR.addItem();
          const lastIdx = _items.length - 1;
          _items[lastIdx].kode_barang = found.kode_barang;
          _items[lastIdx].nama = found.nama_barang;
          _items[lastIdx].harga = found.harga_satuan;
          _items[lastIdx].defaultHarga = found.harga_satuan;
          showToast('✅ Berhasil Scan: ' + found.nama_barang, 'success');
          _renderItems();
          _renderSummary();
        } else {
          showToast('❌ Barcode tidak dikenal. Ketik manual saja.', 'error');
        }
      }, (error) => { });
    } catch (err) {
      showToast('Kamera tidak dapat diakses.', 'error');
      KASIR.stopScanner();
    }
  },

  stopScanner() {
    if (this._scanner) {
      this._scanner.clear().catch(e => console.log(e));
      this._scanner = null;
    }
    document.getElementById('modal-container').innerHTML = '';
  },

  async _printBT(text) {
    // Web Bluetooth hanya tersedia di HTTPS atau localhost
    if (!navigator.bluetooth) {
      showToast('Bluetooth tidak didukung di koneksi HTTP. Gunakan HTTPS atau akses via localhost.', 'error');
      return;
    }
    try {
      if (!_bleChar) {
        const btext = document.getElementById('k-btext');
        if (btext) btext.textContent = 'Mencari printer...';
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

      // Helper untuk mendapatkan ESC/POS byte array logo.jpg
      const getLogoBytes = () => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = "logo.jpg";
        img.onload = () => {
          const w = 240; // width gambar di nota (harus kelipatan 8)
          const calcH = Math.round((img.height / img.width) * w);
          const h = calcH - (calcH % 8); // round down
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          // print ke kanvas sebagai B&W (grayscale)
          ctx.filter = "grayscale(100%) contrast(150%) brightness(110%)";
          ctx.drawImage(img, 0, 0, w, h);

          const imgData = ctx.getImageData(0, 0, w, h).data;
          const dataBytes = [];
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x += 8) {
              let b = 0;
              for (let n = 0; n < 8; n++) {
                const i = (y * w + x + n) * 4;
                const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
                // jika gelap (hitam) cetak (1)
                if (imgData[i + 3] > 128 && lum < 128) {
                  b |= (1 << (7 - n));
                }
              }
              dataBytes.push(b);
            }
          }
          const xL = (w / 8) % 256;
          const xH = Math.floor((w / 8) / 256);
          const yL = h % 256;
          const yH = Math.floor(h / 256);
          // ESC a 1 (center), GS v 0 0 xL xH yL yH, ESC a 0 (left)
          resolve(new Uint8Array([
            27, 97, 1,
            29, 118, 48, 0, xL, xH, yL, yH,
            ...dataBytes,
            27, 97, 0, 10
          ]));
        };
        img.onerror = () => resolve(null);
      });

      const ESC = String.fromCharCode(27);
      const GS = String.fromCharCode(29);
      // ESC @ (Reset), ESC a 0 (left)
      const textFull = ESC + '@' + ESC + 'a\x00\n' + text + '\n\n\n' + GS + 'V\x41\x03';
      const textBytes = new TextEncoder().encode(textFull);

      let finalData = textBytes;
      try {
        const logoData = await getLogoBytes();
        if (logoData) {
          const combine = new Uint8Array(logoData.length + textBytes.length);
          combine.set(logoData);
          combine.set(textBytes, logoData.length);
          finalData = combine;
        }
      } catch (err) { }

      for (let i = 0; i < finalData.length; i += 200) {
        await _bleChar.writeValue(finalData.slice(i, i + 200));
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
      border: 1.5px solid var(--border); background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(8px);
      font-size: 13px; font-weight: 600; cursor: pointer;
      text-align: center; color: var(--muted);
      font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.6;
      transition: all .2s ease;
    }
    .k-metode.active {
      border-color: var(--green); background: rgba(236, 253, 245, 0.8); color: var(--green-dark); font-weight: 700; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
    }
    .ble-dot { width:10px; height:10px; border-radius:50%; background:#d1d5db; flex-shrink:0; }
    .ble-dot.on { background:#22c55e; box-shadow: 0 0 8px #22c55e; }
    .bottom-nav { grid-template-columns: repeat(5, 1fr) !important; }
    .nav-item   { font-size: 8.5px !important; }
    .nav-icon   { width: 19px !important; height: 19px !important; }
    
    .glass-dropdown {
      position: absolute; z-index: 999; background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px); border-radius: 12px;
      border: 1px solid rgba(229, 231, 235, 0.5);
      box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: none; overflow: hidden;
      max-height: 250px; overflow-y: auto;
    }
    .dd-item {
      padding: 10px 14px; border-bottom: 1px solid #f3f4f6; cursor: pointer;
      display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;
    }
    .dd-item:hover { background: #f0fdf4; }
    .dd-nama { font-weight: 600; font-size: 13px; color: var(--text); }
    .dd-harga { font-weight: 700; font-size: 12px; color: var(--green); }
  `;
  document.head.appendChild(style);
}

/* ===== LOCAL HELPERS ===== */
function _escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _escAttr(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function _showConfetti() {
  const wrap = document.createElement('div');
  wrap.className = 'confetti-wrap';
  const colors = ['#10b981','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#f97316'];
  for (let i = 0; i < 48; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const size = 6 + Math.random() * 7;
    p.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:${Math.random()*0.4}s;animation-duration:${0.9+Math.random()*0.7}s;width:${size}px;height:${size}px;border-radius:${Math.random()>.5?'50%':'3px'};`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2200);
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