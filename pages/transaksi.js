// pages/transaksi.js
import { db, isConfigured } from '../supabase.js';
import { fmt, today, showToast, buildStrukText, escHtml, escAttr } from '../utils.js';

let _barangList = [];
let _items = [];
let _itemId = 0;

export async function renderTransaksi(container) {
  _items = [];
  _itemId = 0;

  if (!isConfigured) {
    container.innerHTML = `
      <div class="cfg-warn">
        <h3>⚙️ Supabase Belum Dikonfigurasi</h3>
        <p>Edit file <code>env.js</code> dan isi URL serta Anon Key Supabase Anda.</p>
      </div>`;
    return;
  }

  const { data, error } = await db.from('ms_barang').select('*').order('nama_barang');
  if (error) {
    container.innerHTML = `<div class="card"><div class="empty"><div class="empty-ico">⚠️</div><div>${error.message}</div></div></div>`;
    return;
  }
  _barangList = data || [];

  container.innerHTML = buildPageHTML();
  document.getElementById('trx-add-btn').addEventListener('click', addItem);
  document.getElementById('trx-save-btn').addEventListener('click', simpanPenjualan);
  document.getElementById('trx-reset-btn').addEventListener('click', resetForm);
  renderItems();
}

function buildPageHTML() {
  return `
    <div class="gap-12">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="sec-lbl" style="margin:0">Daftar Barang</div>
          <button id="trx-add-btn" class="btn btn-secondary btn-sm">+ Tambah Barang</button>
        </div>
        <div id="trx-items-list"></div>
      </div>

      <div id="trx-summary-wrap" style="display:none">
        <div class="sec-lbl">Ringkasan</div>
        <div class="summary-box">
          <div id="trx-sum-rows"></div>
          <hr class="sum-divider">
          <div class="sum-total">
            <div class="sum-total-lbl">Total</div>
            <div class="sum-total-val" id="trx-sum-val">Rp 0</div>
          </div>
        </div>
      </div>

      <div>
        <button id="trx-save-btn" class="btn btn-primary">✅ Simpan Penjualan</button>
        <button id="trx-reset-btn" class="btn btn-outline mt-12">🔄 Reset / Mulai Baru</button>
      </div>
    </div>`;
}

function addItem() {
  if (!_barangList.length) {
    showToast('Belum ada data barang. Tambahkan di menu Master terlebih dahulu.', 'warning');
    return;
  }
  _items.push({ id: ++_itemId, kode_barang: '', nama_barang: '', harga_satuan: 0, qty: 1, subtotal: 0 });
  renderItems();
}

function removeItem(id) {
  _items = _items.filter(i => i.id !== id);
  renderItems();
}

window.TRX = {
  closeModal() {
    document.getElementById('modal-container').innerHTML = '';
    resetForm();
  },
  _shareWA(text) {
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  },
  removeItem,
  onBarangChange(id, kode) {
    const item = _items.find(i => i.id === id);
    const barang = _barangList.find(b => b.kode_barang === kode);
    if (!item) return;
    if (barang) {
      item.kode_barang = barang.kode_barang;
      item.nama_barang = barang.nama_barang;
      item.harga_satuan = Number(barang.harga_satuan);
      item.subtotal = item.qty * item.harga_satuan;
    } else {
      item.kode_barang = item.nama_barang = '';
      item.harga_satuan = item.subtotal = 0;
    }
    renderItems();
  },
  onQtyChange(id, val) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    item.qty = parseFloat(val) || 0;
    item.subtotal = item.qty * item.harga_satuan;
    renderSummary();
    const el = document.getElementById(`sub-${id}`);
    if (el) el.textContent = fmt(item.subtotal);
  },
};

function renderItems() {
  const el = document.getElementById('trx-items-list');
  const sw = document.getElementById('trx-summary-wrap');
  if (!el) return;

  if (!_items.length) {
    el.innerHTML = `
      <div class="empty" style="padding:20px 0">
        <div class="empty-ico">🛒</div>
        <div>Tap <b>+ Tambah Barang</b> untuk mulai.</div>
      </div>`;
    if (sw) sw.style.display = 'none';
    return;
  }

  const opts = _barangList.map(b =>
    `<option value="${escAttr(b.kode_barang)}">${escHtml(b.nama_barang)} — ${fmt(b.harga_satuan)}</option>`
  ).join('');

  el.innerHTML = _items.map(it => `
    <div class="item-row" id="row-${it.id}">
      <div>
        <select class="ii" style="margin-bottom:6px" onchange="TRX.onBarangChange(${it.id}, this.value)">
          <option value="">— Pilih Barang —</option>
          ${opts.replace(`value="${escAttr(it.kode_barang)}"`, `value="${escAttr(it.kode_barang)}" selected`)}
        </select>
        ${it.kode_barang ? `<div class="item-sub">Harga satuan: <b>${fmt(it.harga_satuan)}</b></div>` : ''}
      </div>
      <div>
        <input class="ii r" type="number" min="0.5" step="0.5" value="${it.qty}"
          placeholder="Qty" inputmode="decimal"
          onchange="TRX.onQtyChange(${it.id}, this.value)"
          oninput="TRX.onQtyChange(${it.id}, this.value)"
          style="margin-bottom:6px">
        <div class="item-harga-display" id="sub-${it.id}">${fmt(it.subtotal)}</div>
      </div>
      <button class="btn btn-danger btn-icon" onclick="TRX.removeItem(${it.id})" title="Hapus">✕</button>
    </div>`).join('');

  if (sw) sw.style.display = 'block';
  renderSummary();
}

function renderSummary() {
  const rowsEl = document.getElementById('trx-sum-rows');
  const valEl = document.getElementById('trx-sum-val');
  if (!rowsEl) return;

  const valid = _items.filter(i => i.kode_barang);
  rowsEl.innerHTML = valid.map(i => `
    <div class="sum-row">
      <span>${escHtml(i.nama_barang)} <span style="opacity:.7;font-size:12px">× ${i.qty}</span></span>
      <span style="font-weight:600">${fmt(i.subtotal)}</span>
    </div>`).join('');

  const total = valid.reduce((s, i) => s + i.subtotal, 0);
  if (valEl) valEl.textContent = fmt(total);
}

async function generateNoFaktur() {
  const todayStr = today();
  const todayKey = todayStr.replace(/-/g, '');

  const { data: tglData } = await db
    .from('tm_module').select('value').eq('id', 'tanggal_sistem').single();

  let counter;
  if (!tglData || tglData.value !== todayStr) {
    counter = 1;
    await db.from('tm_module').upsert([
      { id: 'tanggal_sistem', value: todayStr, updated_at: new Date().toISOString() },
      { id: 'faktur_counter', value: String(counter), updated_at: new Date().toISOString() },
    ]);
  } else {
    const { data: ctrData } = await db
      .from('tm_module').select('value').eq('id', 'faktur_counter').single();
    counter = parseInt(ctrData?.value || '0') + 1;
    await db.from('tm_module').upsert(
      { id: 'faktur_counter', value: String(counter), updated_at: new Date().toISOString() }
    );
  }

  return `SJ-${todayKey}-${String(counter).padStart(4, '0')}`;
}

async function simpanPenjualan() {
  const valid = _items.filter(i => i.kode_barang && i.qty > 0);
  if (!valid.length) {
    showToast('Pilih barang dan isi qty terlebih dahulu', 'error');
    return;
  }

  const saveBtn = document.getElementById('trx-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Menyimpan...';

  try {
    const noFaktur = await generateNoFaktur();
    const totalHarga = valid.reduce((s, i) => s + i.subtotal, 0);
    const totalQty = valid.reduce((s, i) => s + i.qty, 0);
    const todayStr = today();

    const { error: e1 } = await db.from('tr_penjualan').insert({
      no_faktur: noFaktur,
      tanggal: todayStr,
      total_harga: totalHarga,
      total_qty: totalQty,
    });
    if (e1) throw e1;

    const { error: e2 } = await db.from('tr_penjualan_detail').insert(
      valid.map(i => ({
        no_faktur: noFaktur,
        kode_barang: i.kode_barang,
        nama_barang: i.nama_barang,
        qty: i.qty,
        harga_satuan: i.harga_satuan,
        subtotal: i.subtotal,
      }))
    );
    if (e2) throw e2;

    showToast(`✅ ${noFaktur} berhasil disimpan!`);
    showSuccessModal(noFaktur, valid, totalHarga);
  } catch (err) {
    showToast('Gagal menyimpan: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '✅ Simpan Penjualan';
  }
}

function showSuccessModal(noFaktur, items, total) {
  const strukItems = items.map(i => ({
    nama: i.nama_barang, qty: String(i.qty), harga: i.harga_satuan, satuan: 'pcs'
  }));

  const struktxt = buildStrukText({
    noFaktur, tanggal: new Date().toISOString(),
    namaPelanggan: 'Pelanggan (Transaksi)',
    catatan: '', items: strukItems, total, metode: 'Tunai',
  });
  const safeTxt = struktxt.replace(/`/g, "'");

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-backdrop" id="trx-modal">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="drag-bar"></div>
        <div class="sheet-title">Penjualan Berhasil ✅</div>
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-family:monospace;font-size:18px;font-weight:800;color:var(--green);
            background:var(--green-light);padding:10px 20px;border-radius:10px;display:inline-block">
            ${noFaktur}
          </div>
          <div style="margin-top:8px;font-size:13px;color:var(--muted)">No. Faktur Penjualan</div>
        </div>
        <div class="summary-box" style="margin-bottom:14px">
          ${items.map(i => `
            <div class="sum-row">
              <span>${escHtml(i.nama_barang)} <span style="opacity:.7;font-size:12px">× ${i.qty}</span></span>
              <span style="font-weight:600">${fmt(i.subtotal)}</span>
            </div>`).join('')}
          <hr class="sum-divider">
          <div class="sum-total">
            <div class="sum-total-lbl">Total</div>
            <div class="sum-total-val">${fmt(total)}</div>
          </div>
        </div>
        <button style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
          padding:14px 16px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:13px;
          font-size:14px;font-weight:600;cursor:pointer;color:#1e40af;
          font-family:'Plus Jakarta Sans',sans-serif;margin-bottom:10px"
          onclick="TRX._shareWA(\`${safeTxt}\`)">
          💬 Bagikan Bon ke WhatsApp
        </button>
        <button class="btn btn-primary" onclick="TRX.closeModal()">🆕 Transaksi Baru</button>
      </div>
    </div>`;
  document.getElementById('trx-modal').addEventListener('click', () => TRX.closeModal());
}

function resetForm() {
  _items = [];
  _itemId = 0;
  renderItems();
  renderSummary();
}