// pages/dashboard.js
import { db, isConfigured } from '../supabase.js';
import { fmt, today, fmtDate } from '../utils.js';

export async function renderDashboard(container) {
  if (!isConfigured) {
    container.innerHTML = notConfiguredHTML() + dashboardSkeletonHTML();
    return;
  }

  container.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const todayStr = today();

    // Fetch penjualan hari ini
    const { data: penjualan, error: e1 } = await db
      .from('tr_penjualan')
      .select('total_harga, total_qty, no_faktur, tanggal')
      .eq('tanggal', todayStr)
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    // Fetch hutang aktif
    const { data: hutangData, error: e2 } = await db
      .from('tr_hutang')
      .select('*')
      .eq('status', 'belum_lunas')
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    const totalHarga = penjualan.reduce((s, r) => s + Number(r.total_harga), 0);
    const totalQty = penjualan.reduce((s, r) => s + Number(r.total_qty), 0);
    const jmlFaktur = penjualan.length;
    const totalHutang = (hutangData || []).reduce((s, h) => s + Number(h.jumlah), 0);

    container.innerHTML = `
      <div class="gap-12">

        <!-- STATS -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-lbl">Penjualan hari ini</div>
            <div class="stat-val">${fmt(totalHarga)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-lbl">Total qty terjual</div>
            <div class="stat-val">${totalQty.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <!-- RINGKASAN -->
        <div class="card">
          <div class="sec-lbl">Ringkasan — ${fmtDate(todayStr)}</div>
          <div class="stats-grid" style="margin-bottom:0">
            <div style="text-align:center">
              <div style="font-size:28px;font-weight:800;color:var(--green)">${jmlFaktur}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">Transaksi</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:28px;font-weight:800;color:var(--green)">${totalQty.toLocaleString('id-ID')}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">Total Qty</div>
            </div>
          </div>
        </div>

        <!-- FAKTUR TERKINI -->
        ${jmlFaktur > 0 ? `
        <div class="card">
          <div class="sec-lbl">Faktur Terkini</div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>No Faktur</th>
                  <th class="r">Total</th>
                  <th class="r">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${penjualan.slice(0, 5).map(p => `
                  <tr>
                    <td><span style="font-family:monospace;font-size:12px">${p.no_faktur}</span></td>
                    <td class="r" style="font-weight:700;color:var(--green)">${fmt(p.total_harga)}</td>
                    <td class="r">${Number(p.total_qty).toLocaleString('id-ID')}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          ${jmlFaktur > 5 ? `<div style="text-align:center;margin-top:10px;font-size:12px;color:var(--muted)">+${jmlFaktur - 5} transaksi lainnya</div>` : ''}
        </div>` : `
        <div class="card">
          <div class="empty">
            <div class="empty-ico">🛒</div>
            <div>Belum ada transaksi hari ini.</div>
          </div>
        </div>`}

        <!-- TOTAL BANNER -->
        <div class="card" style="background:var(--green);border:none">
          <div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Total Penjualan</div>
          <div style="color:#fff;font-size:30px;font-weight:800">${fmt(totalHarga)}</div>
          <div style="color:rgba(255,255,255,.65);font-size:12px;margin-top:4px">${fmtDate(todayStr)}</div>
        </div>

        <!-- HUTANG AKTIF -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div class="sec-lbl" style="margin:0">Hutang Aktif</div>
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('hutang')">
              Kelola Hutang →
            </button>
          </div>

          ${!hutangData || hutangData.length === 0 ? `
            <div class="card">
              <div class="empty" style="padding:20px 0">
                <div class="empty-ico">✅</div>
                <div>Tidak ada hutang aktif.</div>
              </div>
            </div>` : `

            <div class="card" style="background:#fef2f2;border-color:#fecaca;padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-size:13px;font-weight:700;color:#991b1b">Total Piutang</div>
                  <div style="font-size:11px;color:#dc2626;margin-top:2px">${hutangData.length} pelanggan belum lunas</div>
                </div>
                <div style="font-size:22px;font-weight:800;color:#dc2626">${fmt(totalHutang)}</div>
              </div>
            </div>

            ${hutangData.slice(0, 3).map(h => `
              <div class="card" style="margin-bottom:8px;padding:12px 14px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-size:14px;font-weight:700;color:var(--text)">${_esc(h.nama_pelanggan)}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px">${fmtDate(h.tanggal)}${h.catatan ? ' · ' + h.catatan : ''}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:16px;font-weight:700;color:#dc2626">${fmt(h.jumlah)}</div>
                    <button class="btn btn-secondary btn-sm" style="margin-top:4px;font-size:11px;padding:4px 10px"
                      onclick="navigateTo('hutang')">Lunas →</button>
                  </div>
                </div>
              </div>`).join('')}

            ${hutangData.length > 3 ? `
              <div style="text-align:center;margin-top:4px">
                <button class="btn btn-outline" onclick="navigateTo('hutang')"
                  style="font-size:13px;padding:10px">
                  Lihat semua ${hutangData.length} hutang →
                </button>
              </div>` : ''}
          `}
        </div>

      </div>`;

  } catch (err) {
    container.innerHTML = `
      <div class="card">
        <div class="empty">
          <div class="empty-ico">⚠️</div>
          <div>Gagal memuat data.<br><span style="font-size:12px;color:var(--muted)">${err.message}</span></div>
        </div>
      </div>`;
  }
}

function notConfiguredHTML() {
  return `
    <div class="cfg-warn">
      <h3>⚙️ Supabase Belum Dikonfigurasi</h3>
      <p>Edit file <code>env.js</code> dan isi <code>SUPABASE_URL</code>
      serta <code>SUPABASE_ANON_KEY</code>.</p>
    </div>`;
}

function dashboardSkeletonHTML() {
  return `
    <div class="stats-grid">
      <div class="stat-card" style="opacity:.4">
        <div class="stat-icon">💰</div>
        <div class="stat-lbl">Penjualan hari ini</div>
        <div class="stat-val">Rp —</div>
      </div>
      <div class="stat-card" style="opacity:.4">
        <div class="stat-icon">📦</div>
        <div class="stat-lbl">Total qty terjual</div>
        <div class="stat-val">—</div>
      </div>
    </div>`;
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}