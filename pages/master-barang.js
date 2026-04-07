// pages/master-barang.js
import { db, isConfigured } from '../supabase.js';
import { fmt, showToast, escHtml, escAttr } from '../utils.js';

let _container = null;
let _editMode = false;

export async function renderMasterBarang(container) {
  _container = container;
  _editMode = false;

  if (!isConfigured) {
    container.innerHTML = `
      <div class="cfg-warn">
        <h3>⚙️ Supabase Belum Dikonfigurasi</h3>
        <p>Edit file <code>env.js</code> dan isi URL serta Anon Key Supabase Anda.</p>
      </div>`;
    return;
  }

  container.innerHTML = getFormHTML(false, {}) + '<div class="mt-12" id="mb-table-wrap"></div>';

  // Pasang event handler form setelah render
  document.getElementById('mb-form').addEventListener('submit', handleSave);

  await loadTable();
}

/* ===== FORM HTML ===== */
function getFormHTML(editMode, barang = {}) {
  return `
    <div class="card" id="mb-form-card">
      <div class="sec-lbl">${editMode ? '✏️ Edit Barang' : '➕ Tambah Barang Baru'}</div>
      <form id="mb-form" autocomplete="off">
        <div class="field">
          <label>Kode Barang *</label>
          <input id="mb-kode" type="text" placeholder="Mis: BRS-001"
            value="${barang.kode_barang || ''}"
            ${editMode ? 'disabled' : 'required'}
            style="text-transform:uppercase">
        </div>
        <div class="field">
          <label>Nama Barang *</label>
          <input id="mb-nama" type="text" placeholder="Mis: Beras Premium 5kg"
            value="${barang.nama_barang || ''}" required>
        </div>
        <div class="field">
          <label>Harga Masuk (1 Pack/Kardus) (Rp)</label>
          <input id="mb-harga-masuk" type="number" placeholder="0" min="0" step="100"
            value="${barang.harga_masuk || ''}" inputmode="numeric" oninput="MB.calcModal()">
        </div>
        <div class="field">
          <label>Isi per Pack/Kardus (Pcs/Botol)</label>
          <input id="mb-isi" type="number" placeholder="1" min="1" step="0.1"
            value="${barang.isi_per_pack || ''}" inputmode="decimal" oninput="MB.calcModal()">
        </div>
        <div class="field">
          <label>Harga Jual per Unit (Rp) * <span id="mb-modal-hint" style="margin-left:6px;font-size:11px;font-weight:600;color:var(--green)"></span></label>
          <input id="mb-harga" type="number" placeholder="0" min="0" step="100"
            value="${barang.harga_satuan || ''}" required inputmode="numeric">
        </div>
        <div class="btn-row mt-12">
          <button type="submit" class="btn btn-primary" style="flex:1">
            ${editMode ? '💾 Update Barang' : '✅ Simpan Barang'}
          </button>
          ${editMode ? `<button type="button" class="btn btn-outline" style="width:auto;padding:13px 16px" onclick="MB.cancelEdit()">Batal</button>` : ''}
        </div>
      </form>
    </div>`;
}

/* ===== LOAD TABLE ===== */
async function loadTable() {
  let wrap = document.getElementById('mb-table-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'mb-table-wrap';
    wrap.className = 'mt-12';
    _container.appendChild(wrap);
  }

  wrap.innerHTML = '';

  const { data, error } = await db
    .from('ms_barang')
    .select('*')
    .order('nama_barang');

  if (error) {
    wrap.innerHTML = `<div class="card"><div class="empty"><div class="empty-ico">⚠️</div><div>${error.message}</div></div></div>`;
    return;
  }

  const tableHTML = data.length === 0
    ? `<div class="card">
        <div class="empty">
          <div class="empty-ico">📦</div>
          <div>Belum ada data barang.<br>Tambahkan barang menggunakan form di atas.</div>
        </div>
      </div>`
    : `<div class="card" style="padding:0">
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Barang</th>
                <th class="r">Harga Satuan</th>
                <th class="c">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(b => `
                <tr>
                  <td><span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--muted)">${escHtml(b.kode_barang)}</span></td>
                  <td style="font-weight:600">${escHtml(b.nama_barang)}</td>
                  <td class="r" style="font-weight:700;color:var(--green);white-space:nowrap">${fmt(b.harga_satuan)}</td>
                  <td class="c">
                    <div style="display:flex;gap:6px;justify-content:center">
                      <button class="btn btn-secondary btn-sm btn-icon" title="Edit"
                        onclick="MB.editBarang('${escAttr(b.kode_barang)}')">✏️</button>
                      <button class="btn btn-danger btn-sm btn-icon" title="Hapus"
                        onclick="MB.deleteBarang('${escAttr(b.kode_barang)}','${escAttr(b.nama_barang)}')">🗑️</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div class="sec-lbl" style="margin:0">Daftar Barang (${data.length})</div>
      ${data.length > 0 ? `<button class="btn btn-danger btn-sm" onclick="MB.hapusSemuaBarang()" style="font-size:12px;padding:6px 12px">🗑️ Hapus Semua</button>` : ''}
    </div>
    ${tableHTML}`;
}

/* ===== HANDLE SAVE (Tambah / Update) ===== */
async function handleSave(e) {
  e.preventDefault();
  const kode = document.getElementById('mb-kode').value.trim().toUpperCase();
  const nama = document.getElementById('mb-nama').value.trim();
  const harga = parseFloat(document.getElementById('mb-harga').value) || 0;
  const hargaMasuk = parseFloat(document.getElementById('mb-harga-masuk').value) || null;
  const isiPerPack = parseFloat(document.getElementById('mb-isi').value) || null;

  if (!kode || !nama || harga <= 0) {
    showToast('Lengkapi semua field dengan benar', 'error'); return;
  }

  const btn = document.querySelector('#mb-form button[type="submit"]');
  btn.disabled = true;

  try {
    if (_editMode) {
      let payload = { nama_barang: nama, harga_satuan: harga };
      if (!isNaN(hargaMasuk) && hargaMasuk !== null) payload.harga_masuk = hargaMasuk;
      if (!isNaN(isiPerPack) && isiPerPack !== null) payload.isi_per_pack = isiPerPack;

      // Coba update lengkap
      let { error } = await db.from('ms_barang').update(payload).eq('kode_barang', kode);

      // Fallback jika tidak ada kolom di DB
      if (error && error.message && error.message.includes('does not exist')) {
        showToast('Info: Kolom harga_masuk belum ada di Database', 'warning');
        const { error: err2 } = await db.from('ms_barang').update({ nama_barang: nama, harga_satuan: harga }).eq('kode_barang', kode);
        error = err2;
      }
      
      if (error) throw error;
      showToast(`Barang ${nama} berhasil diupdate ✅`);
    } else {
      let payload = { kode_barang: kode, nama_barang: nama, harga_satuan: harga };
      if (!isNaN(hargaMasuk) && hargaMasuk !== null) payload.harga_masuk = hargaMasuk;
      if (!isNaN(isiPerPack) && isiPerPack !== null) payload.isi_per_pack = isiPerPack;

      let { error } = await db.from('ms_barang').insert(payload);

      if (error && error.message && error.message.includes('does not exist')) {
        showToast('Info: Kolom harga_masuk belum ada di Database', 'warning');
        const { error: err2 } = await db.from('ms_barang').insert({ kode_barang: kode, nama_barang: nama, harga_satuan: harga });
        error = err2;
      }

      if (error) {
        if (error.code === '23505') { showToast('Kode barang sudah digunakan', 'error'); return; }
        throw error;
      }
      showToast(`Barang ${nama} berhasil ditambahkan ✅`);
    }
    MB.cancelEdit();
    await loadTable();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ===== GLOBAL MB OBJECT (untuk onclick di HTML string) ===== */
window.MB = {
  calcModal() {
    const hk = parseFloat(document.getElementById('mb-harga-masuk')?.value) || 0;
    const isi = parseFloat(document.getElementById('mb-isi')?.value) || 0;
    const hint = document.getElementById('mb-modal-hint');
    if (hk > 0 && isi > 0 && hint) {
      const r_modal = Math.ceil(hk / isi);
      hint.textContent = `(Modal per Unit: Rp ${r_modal.toLocaleString('id-ID')})`;
    } else if (hint) {
      hint.textContent = '';
    }
  },

  async editBarang(kode) {
    const { data, error } = await db.from('ms_barang').select('*').eq('kode_barang', kode).single();
    if (error) { showToast('Gagal memuat data', 'error'); return; }

    _editMode = true;
    const formCard = document.getElementById('mb-form-card');
    formCard.outerHTML = getFormHTML(true, data);

    document.getElementById('mb-form').addEventListener('submit', handleSave);
    document.getElementById('mb-form-card').scrollIntoView({ behavior: 'smooth' });
    MB.calcModal();
  },

  cancelEdit() {
    _editMode = false;
    const formCard = document.getElementById('mb-form-card');
    const newForm = document.createElement('div');
    newForm.innerHTML = getFormHTML(false, {});
    formCard.replaceWith(newForm.firstElementChild);
    document.getElementById('mb-form').addEventListener('submit', handleSave);
  },

  async deleteBarang(kode, nama) {
    if (!confirm(`Hapus barang "${nama}"?\n\nData yang sudah dihapus tidak bisa dikembalikan.`)) return;
    const { error } = await db.from('ms_barang').delete().eq('kode_barang', kode);
    if (error) { showToast('Gagal menghapus: ' + error.message, 'error'); return; }
    showToast(`Barang ${nama} berhasil dihapus`);
    await loadTable();
  },

  async hapusSemuaBarang() {
    if (!confirm('Hapus SEMUA barang dari master produk?\n\nSeluruh data ms_barang akan dihapus permanen. Lanjutkan?')) return;
    if (!confirm('Konfirmasi sekali lagi: Yakin ingin menghapus SEMUA produk?')) return;
    const { error } = await db.from('ms_barang').delete().neq('kode_barang', '_dummy_');
    if (error) { showToast('Gagal: ' + error.message, 'error'); return; }
    showToast('Semua barang berhasil dihapus 🗑️', 'success');
    await loadTable();
  },
};

/* ===== HELPERS ===== */
// escHtml and escAttr imported from utils.js
