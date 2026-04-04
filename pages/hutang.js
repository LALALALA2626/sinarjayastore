// pages/hutang.js — Manajemen Hutang Pelanggan
import { fmt, fmtDate, fmtDateShort, showToast } from '../utils.js';
import { db, isConfigured } from '../supabase.js';

/* ===== ENTRY POINT ===== */
export async function renderHutang(container) {
    container.innerHTML = `
    <div class="gap-12">

      <!-- STATS -->
      <div class="stats-grid" style="margin-bottom:0">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-lbl">Hutang aktif</div>
          <div class="stat-val" id="h-aktif">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💸</div>
          <div class="stat-lbl">Total piutang</div>
          <div class="stat-val" id="h-total">—</div>
        </div>
      </div>

      <!-- FORM TAMBAH HUTANG -->
      <div class="card">
        <div class="sec-lbl">➕ Catat Hutang Baru</div>
        <div class="field">
          <label>Nama Pelanggan *</label>
          <input id="h-nama" type="text" placeholder="Nama pelanggan..."
            autocomplete="off" autocapitalize="words">
        </div>
        <div class="field">
          <label>Jumlah Hutang (Rp) *</label>
          <input id="h-jumlah" type="number" placeholder="0" inputmode="numeric">
        </div>
        <div class="field">
          <label>No. Faktur (opsional)</label>
          <input id="h-faktur" type="text" placeholder="Mis: SJ-20260404-0001"
            autocomplete="off">
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Catatan (opsional)</label>
          <input id="h-catatan" type="text" placeholder="Mis: beli beras 5kg"
            autocomplete="off">
        </div>
        <button class="btn btn-primary" style="margin-top:14px"
          onclick="HUTANG.simpan()">💾 Simpan Hutang</button>
      </div>

      <!-- FILTER -->
      <div class="card" style="padding:12px 14px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="h-search" type="text" placeholder="Cari nama pelanggan..."
            oninput="HUTANG.filter()"
            style="flex:1;min-width:140px;padding:9px 12px;border:1.5px solid var(--border);
            border-radius:10px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;
            background:#fafafa;color:var(--text)">
          <select id="h-filter-status" onchange="HUTANG.filter()"
            style="padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
            font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;background:#fafafa;
            color:var(--text);cursor:pointer;appearance:none;-webkit-appearance:none">
            <option value="semua">Semua</option>
            <option value="belum_lunas" selected>Belum Lunas</option>
            <option value="lunas">Lunas</option>
          </select>
        </div>
      </div>

      <!-- LIST HUTANG -->
      <div id="h-list"></div>

    </div>`;

    await _loadHutang();
}

/* ===== DATA ===== */
let _allHutang = [];

async function _loadHutang() {
    const el = document.getElementById('h-list');
    if (!el) return;

    if (!isConfigured || !db) {
        el.innerHTML = `
      <div class="card">
        <div class="empty">
          <div class="empty-ico">⚙️</div>
          <div>Supabase belum dikonfigurasi.</div>
        </div>
      </div>`;
        return;
    }

    el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    const { data, error } = await db
        .from('tr_hutang')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        el.innerHTML = `
      <div class="card">
        <div class="empty">
          <div class="empty-ico">⚠️</div>
          <div>${error.message}</div>
        </div>
      </div>`;
        return;
    }

    _allHutang = data || [];
    _updateStats();
    HUTANG.filter();
}

function _updateStats() {
    const aktif = _allHutang.filter(h => h.status === 'belum_lunas');
    const total = aktif.reduce((s, h) => s + Number(h.jumlah), 0);
    const elA = document.getElementById('h-aktif');
    const elT = document.getElementById('h-total');
    if (elA) elA.textContent = aktif.length + ' orang';
    if (elT) elT.textContent = fmt(total);
}

function _renderList(data) {
    const el = document.getElementById('h-list');
    if (!el) return;

    if (!data.length) {
        el.innerHTML = `
      <div class="empty" style="padding:32px 0">
        <div class="empty-ico">📭</div>
        <div>Tidak ada data hutang.</div>
      </div>`;
        return;
    }

    el.innerHTML = data.map(h => `
    <div class="card" style="margin-bottom:8px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">${_esc(h.nama_pelanggan)}</div>
          ${h.no_faktur ? `<div style="font-family:monospace;font-size:11px;color:var(--muted)">${_esc(h.no_faktur)}</div>` : ''}
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${fmtDate(h.tanggal)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:700;color:${h.status === 'lunas' ? 'var(--green)' : 'var(--red)'}">${fmt(h.jumlah)}</div>
          <span class="badge ${h.status === 'lunas' ? 'badge-green' : 'badge-red'}">
            ${h.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
          </span>
        </div>
      </div>
      ${h.catatan ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-style:italic">${_esc(h.catatan)}</div>` : ''}
      ${h.status === 'lunas' && h.tanggal_lunas ? `
        <div style="font-size:11px;color:var(--green);margin-bottom:8px">
          ✓ Lunas pada ${fmtDate(h.tanggal_lunas)}
        </div>` : ''}
      <div style="display:flex;gap:6px;justify-content:flex-end">
        ${h.status === 'belum_lunas' ? `
          <button class="btn btn-secondary btn-sm" onclick="HUTANG.tandaiLunas(${h.id})">
            ✓ Tandai Lunas
          </button>` : ''}
        <button class="btn btn-secondary btn-sm btn-icon" onclick="HUTANG.edit(${h.id})" title="Edit">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="HUTANG.hapus(${h.id})" title="Hapus">🗑️</button>
      </div>
    </div>`).join('');
}

/* ===== GLOBAL HUTANG OBJECT ===== */
window.HUTANG = {
    filter() {
        const q = (document.getElementById('h-search')?.value || '').toLowerCase();
        const status = document.getElementById('h-filter-status')?.value || 'semua';

        let filtered = _allHutang;
        if (q) filtered = filtered.filter(h => h.nama_pelanggan.toLowerCase().includes(q));
        if (status !== 'semua') filtered = filtered.filter(h => h.status === status);

        _renderList(filtered);
    },

    async simpan() {
        const nama = (document.getElementById('h-nama')?.value || '').trim();
        const jumlah = parseFloat(document.getElementById('h-jumlah')?.value || '0');
        const faktur = (document.getElementById('h-faktur')?.value || '').trim();
        const catatan = (document.getElementById('h-catatan')?.value || '').trim();

        if (!nama) { showToast('Isi nama pelanggan!', 'error'); return; }
        if (!jumlah || jumlah <= 0) { showToast('Isi jumlah hutang!', 'error'); return; }

        if (!isConfigured || !db) {
            showToast('Supabase belum dikonfigurasi', 'error'); return;
        }

        const tanggal = new Date().toISOString().slice(0, 10);

        const { error } = await db.from('tr_hutang').insert({
            nama_pelanggan: nama,
            jumlah,
            no_faktur: faktur || null,
            catatan: catatan || null,
            tanggal,
            status: 'belum_lunas',
        });

        if (error) { showToast('Gagal simpan: ' + error.message, 'error'); return; }

        // Reset form
        ['h-nama', 'h-jumlah', 'h-faktur', 'h-catatan'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        showToast('Hutang berhasil dicatat ✅', 'success');
        await _loadHutang();
    },

    async tandaiLunas(id) {
        if (!confirm('Tandai hutang ini sebagai lunas?')) return;

        const tanggalLunas = new Date().toISOString().slice(0, 10);
        const { error } = await db.from('tr_hutang')
            .update({ status: 'lunas', tanggal_lunas: tanggalLunas })
            .eq('id', id);

        if (error) { showToast('Gagal update: ' + error.message, 'error'); return; }

        showToast('Hutang ditandai lunas ✅', 'success');
        await _loadHutang();
    },

    edit(id) {
        const h = _allHutang.find(x => x.id === id);
        if (!h) return;

        const mc = document.getElementById('modal-container');
        mc.innerHTML = `
      <div class="modal-backdrop" onclick="HUTANG._closeModal()">
        <div class="modal-sheet" onclick="event.stopPropagation()">
          <div class="drag-bar"></div>
          <div class="sheet-title">✏️ Edit Hutang</div>
          <div class="field">
            <label>Nama Pelanggan</label>
            <input id="he-nama" type="text" value="${_esc(h.nama_pelanggan)}" autocomplete="off">
          </div>
          <div class="field">
            <label>Jumlah (Rp)</label>
            <input id="he-jumlah" type="number" value="${h.jumlah}" inputmode="numeric">
          </div>
          <div class="field">
            <label>Catatan</label>
            <input id="he-catatan" type="text" value="${_esc(h.catatan || '')}" autocomplete="off">
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Status</label>
            <select id="he-status">
              <option value="belum_lunas" ${h.status === 'belum_lunas' ? 'selected' : ''}>Belum Lunas</option>
              <option value="lunas"       ${h.status === 'lunas' ? 'selected' : ''}>Lunas</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-outline" style="flex:1" onclick="HUTANG._closeModal()">Batal</button>
            <button class="btn btn-primary" style="flex:2" onclick="HUTANG._simpanEdit(${id})">💾 Simpan</button>
          </div>
        </div>
      </div>`;
    },

    async _simpanEdit(id) {
        const nama = (document.getElementById('he-nama')?.value || '').trim();
        const jumlah = parseFloat(document.getElementById('he-jumlah')?.value || '0');
        const catatan = (document.getElementById('he-catatan')?.value || '').trim();
        const status = document.getElementById('he-status')?.value;

        if (!nama || !jumlah) {
            showToast('Lengkapi data!', 'error'); return;
        }

        const update = {
            nama_pelanggan: nama, jumlah, catatan: catatan || null, status,
            tanggal_lunas: status === 'lunas' ? new Date().toISOString().slice(0, 10) : null,
        };

        const { error } = await db.from('tr_hutang').update(update).eq('id', id);
        if (error) { showToast('Gagal update: ' + error.message, 'error'); return; }

        showToast('Hutang berhasil diupdate ✅', 'success');
        this._closeModal();
        await _loadHutang();
    },

    async hapus(id) {
        if (!confirm('Hapus data hutang ini? Tidak bisa dikembalikan.')) return;

        const { error } = await db.from('tr_hutang').delete().eq('id', id);
        if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }

        showToast('Hutang berhasil dihapus', 'success');
        await _loadHutang();
    },

    _closeModal() {
        const mc = document.getElementById('modal-container');
        if (mc) mc.innerHTML = '';
    },
};

/* ===== HELPER ===== */
function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}