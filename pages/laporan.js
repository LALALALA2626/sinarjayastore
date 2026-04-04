// pages/laporan.js
import { db, isConfigured } from '../supabase.js';
import { fmt, fmtDate, fmtDateShort, showToast, escHtml, escAttr } from '../utils.js';

let _reportType = 'rekap'; // 'rekap' | 'detail'
let _lastResult = [];      // untuk PDF

export async function renderLaporan(container) {
  _reportType = 'rekap';

  if (!isConfigured) {
    container.innerHTML = `
      <div class="cfg-warn">
        <h3>⚙️ Supabase Belum Dikonfigurasi</h3>
        <p>Edit file <code>env.js</code> dan isi URL serta Anon Key Supabase Anda.</p>
      </div>`;
    return;
  }

  // Ambil daftar barang untuk filter
  const { data: barangList } = await db.from('ms_barang').select('kode_barang, nama_barang').order('nama_barang');

  const todayStr = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="gap-12">
      <!-- FILTER CARD -->
      <div class="card">
        <div class="sec-lbl">Filter Laporan</div>
        <div class="filter-row">
          <div class="field" style="margin:0">
            <label>Dari Tanggal</label>
            <input id="lap-dari"  type="date" value="${todayStr}" max="${todayStr}">
          </div>
          <div class="field" style="margin:0">
            <label>Sampai Tanggal</label>
            <input id="lap-sampai" type="date" value="${todayStr}" max="${todayStr}">
          </div>
        </div>

        <div class="field mt-12" style="margin-bottom:12px">
          <label>Filter Barang (Opsional)</label>
          <select id="lap-barang">
            <option value="">— Semua Barang —</option>
            ${(barangList || []).map(b =>
    `<option value="${escAttr(b.kode_barang)}">${escHtml(b.nama_barang)}</option>`
  ).join('')}
          </select>
        </div>

        <div class="field" style="margin-bottom:14px">
          <label>Tipe Laporan</label>
          <div class="type-pills">
            <button class="type-pill active" id="pill-rekap"
              onclick="LAP.setType('rekap')">📊 Rekap</button>
            <button class="type-pill" id="pill-detail"
              onclick="LAP.setType('detail')">📋 Detail</button>
          </div>
        </div>

        <button class="btn btn-primary" onclick="LAP.tampilkan()">
          🔍 Tampilkan Laporan
        </button>
      </div>

      <!-- RESULT AREA -->
      <div id="lap-result"></div>
    </div>`;
}

/* ===== SET TYPE ===== */
window.LAP = {
  setType(type) {
    _reportType = type;
    document.getElementById('pill-rekap').classList.toggle('active', type === 'rekap');
    document.getElementById('pill-detail').classList.toggle('active', type === 'detail');
  },

  async tampilkan() {
    const dari = document.getElementById('lap-dari').value;
    const sampai = document.getElementById('lap-sampai').value;
    const kode = document.getElementById('lap-barang').value;

    if (!dari || !sampai) { showToast('Isi range tanggal terlebih dahulu', 'error'); return; }
    if (dari > sampai) { showToast('Tanggal dari tidak boleh lebih besar dari sampai', 'error'); return; }

    const result = document.getElementById('lap-result');
    result.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    try {
      // Query detail transaksi + join header
      let query = db
        .from('tr_penjualan_detail')
        .select(`
          id, kode_barang, nama_barang, qty, harga_satuan, subtotal,
          tr_penjualan!inner(no_faktur, tanggal, created_at)
        `)
        .gte('tr_penjualan.tanggal', dari)
        .lte('tr_penjualan.tanggal', sampai)
        .order('tr_penjualan(tanggal)', { ascending: true });

      if (kode) query = query.eq('kode_barang', kode);

      const { data, error } = await query;
      if (error) throw error;

      _lastResult = data || [];

      if (_lastResult.length === 0) {
        result.innerHTML = `
          <div class="card">
            <div class="empty">
              <div class="empty-ico">📭</div>
              <div>Tidak ada data untuk filter yang dipilih.</div>
            </div>
          </div>`;
        return;
      }

      if (_reportType === 'rekap') {
        renderRekap(result, _lastResult, dari, sampai);
      } else {
        renderDetail(result, _lastResult, dari, sampai);
      }
    } catch (err) {
      result.innerHTML = `
        <div class="card">
          <div class="empty"><div class="empty-ico">⚠️</div>
          <div>${err.message}</div></div>
        </div>`;
    }
  },

  exportPDF() {
    const el = document.getElementById('lap-print-area');
    if (!el) { showToast('Tampilkan laporan terlebih dahulu', 'warning'); return; }
    if (typeof html2pdf === 'undefined') { showToast('Library PDF belum siap', 'error'); return; }

    const dari = document.getElementById('lap-dari').value;
    const sampai = document.getElementById('lap-sampai').value;
    const fname = `Laporan-SinarJaya-${dari}-sd-${sampai}.pdf`;

    html2pdf().set({
      margin: [10, 10],
      filename: fname,
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(el).save();

    showToast('Mengunduh PDF...', 'success');
  },
};

/* ===== RENDER REKAP ===== */
function renderRekap(container, data, dari, sampai) {
  // Group by barang
  const map = {};
  data.forEach(row => {
    const key = row.kode_barang || row.nama_barang;
    if (!map[key]) {
      map[key] = { kode: row.kode_barang, nama: row.nama_barang, totalQty: 0, totalHarga: 0 };
    }
    map[key].totalQty += Number(row.qty);
    map[key].totalHarga += Number(row.subtotal);
  });

  const rows = Object.values(map).sort((a, b) => b.totalHarga - a.totalHarga);
  const sumHarga = rows.reduce((s, r) => s + r.totalHarga, 0);
  const sumQty = rows.reduce((s, r) => s + r.totalQty, 0);

  container.innerHTML = `
    <div class="card" style="padding:0">
      <div id="lap-print-area" style="padding:16px">
        <div class="report-header">
          <h2>Laporan Rekap Penjualan</h2>
          <div>Toko Sinar Jaya — Sembako & Kelontong</div>
          <div>Periode: ${fmtDateShort(dari)} s/d ${fmtDateShort(sampai)}</div>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Barang</th>
                <th class="r">Total Qty</th>
                <th class="r">Total Harga</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r, i) => `
                <tr>
                  <td class="c" style="color:var(--muted);font-size:12px">${i + 1}</td>
                  <td>
                    <div style="font-weight:600">${escHtml(r.nama)}</div>
                    ${r.kode ? `<div style="font-size:11px;color:var(--muted);font-family:monospace">${escHtml(r.kode)}</div>` : ''}
                  </td>
                  <td class="r" style="font-weight:700">${r.totalQty.toLocaleString('id-ID')}</td>
                  <td class="r" style="font-weight:700;color:var(--green)">${fmt(r.totalHarga)}</td>
                </tr>`).join('')}
              <tr class="total-row">
                <td colspan="2" style="font-weight:700">TOTAL</td>
                <td class="r">${sumQty.toLocaleString('id-ID')}</td>
                <td class="r">${fmt(sumHarga)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style="padding:0 16px 16px">
        <button class="btn btn-secondary" style="width:100%" onclick="LAP.exportPDF()">
          📄 Export PDF
        </button>
      </div>
    </div>`;
}

/* ===== RENDER DETAIL ===== */
function renderDetail(container, data, dari, sampai) {
  const sumHarga = data.reduce((s, r) => s + Number(r.subtotal), 0);
  const sumQty = data.reduce((s, r) => s + Number(r.qty), 0);

  container.innerHTML = `
    <div class="card" style="padding:0">
      <div id="lap-print-area" style="padding:16px">
        <div class="report-header">
          <h2>Laporan Detail Penjualan</h2>
          <div>Toko Sinar Jaya — Sembako & Kelontong</div>
          <div>Periode: ${fmtDateShort(dari)} s/d ${fmtDateShort(sampai)}</div>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>No Faktur</th>
                <th>Tgl</th>
                <th>Barang</th>
                <th class="r">Qty</th>
                <th class="r">Harga Sat.</th>
                <th class="r">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(r => `
                <tr>
                  <td><span style="font-family:monospace;font-size:11px;font-weight:700;color:var(--green)">
                    ${escHtml(r.tr_penjualan.no_faktur)}
                  </span></td>
                  <td style="white-space:nowrap;font-size:12px">${fmtDateShort(r.tr_penjualan.tanggal)}</td>
                  <td>
                    <div style="font-weight:600;font-size:13px">${escHtml(r.nama_barang)}</div>
                    ${r.kode_barang ? `<div style="font-size:11px;color:var(--muted);font-family:monospace">${escHtml(r.kode_barang)}</div>` : ''}
                  </td>
                  <td class="r" style="font-weight:700">${Number(r.qty).toLocaleString('id-ID')}</td>
                  <td class="r" style="font-size:12px;color:var(--muted)">${fmt(r.harga_satuan)}</td>
                  <td class="r" style="font-weight:700;color:var(--green);white-space:nowrap">${fmt(r.subtotal)}</td>
                </tr>`).join('')}
              <tr class="total-row">
                <td colspan="3" style="font-weight:700">TOTAL (${data.length} item)</td>
                <td class="r">${sumQty.toLocaleString('id-ID')}</td>
                <td></td>
                <td class="r">${fmt(sumHarga)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style="padding:0 16px 16px">
        <button class="btn btn-secondary" style="width:100%" onclick="LAP.exportPDF()">
          📄 Export PDF
        </button>
      </div>
    </div>`;
}

/* ===== HELPERS ===== */
// escHtml and escAttr imported from utils.js
