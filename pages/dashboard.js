// pages/dashboard.js
import { db, isConfigured } from './supabase.js';
import { fmt, today, fmtDate } from './utils.js';

export async function renderDashboard(container) {
  if (!isConfigured) {
    container.innerHTML = notConfiguredHTML() + dashboardSkeletonHTML();
    return;
  }

  container.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const todayStr = today();

    // Ambil data penjualan hari ini
    const { data: penjualan, error } = await db
      .from('tr_penjualan')
      .select('total_harga, total_qty, no_faktur, tanggal')
      .eq('tanggal', todayStr)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalHarga = penjualan.reduce((s, r) => s + Number(r.total_harga), 0);
    const totalQty = penjualan.reduce((s, r) => s + Number(r.total_qty), 0);
    const jmlFaktur = penjualan.length;

    container.innerHTML = `
      <div class="gap-12">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-lbl">Total Penjualan Hari Ini</div>
            <div class="stat-val">${fmt(totalHarga)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-lbl">Total Qty Terjual</div>
            <div class="stat-val">${totalQty.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div class="card">
          <div class="sec-lbl">Ringkasan Hari Ini — ${fmtDate(todayStr)}</div>
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
            <div>Belum ada transaksi hari ini.<br>
              <a href="#transaksi" style="color:var(--green);font-weight:700">Mulai transaksi</a>
            </div>
          </div>
        </div>`}

        <div class="card" style="background:linear-gradient(135deg,var(--green),var(--green-mid));border:none">
          <div style="color:rgba(255,255,255,.7);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Total Penjualan</div>
          <div style="color:#fff;font-size:30px;font-weight:800">${fmt(totalHarga)}</div>
          <div style="color:rgba(255,255,255,.65);font-size:12px;margin-top:4px">${fmtDate(todayStr)}</div>
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
      serta <code>SUPABASE_ANON_KEY</code> dengan data dari project Supabase Anda.</p>
    </div>`;
}

function dashboardSkeletonHTML() {
  return `
    <div class="stats-grid">
      <div class="stat-card" style="opacity:.4">
        <div class="stat-icon">💰</div>
        <div class="stat-lbl">Total Penjualan Hari Ini</div>
        <div class="stat-val">Rp —</div>
      </div>
      <div class="stat-card" style="opacity:.4">
        <div class="stat-icon">📦</div>
        <div class="stat-lbl">Total Qty Terjual</div>
        <div class="stat-val">—</div>
      </div>
    </div>`;
}
