// pages/dashboard.js
import { db, isConfigured } from '../supabase.js';
import { fmt, today, fmtDate, showToast } from '../utils.js';

export async function renderDashboard(container) {
  if (!isConfigured) {
    container.innerHTML = notConfiguredHTML() + dashboardSkeletonHTML();
    return;
  }

  container.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const todayStr = today();

    const d = new Date();
    d.setDate(d.getDate() - 6);
    const last7Str = d.toISOString().slice(0, 10);

    const { data: penjualan, error: e1 } = await db
      .from('tr_penjualan')
      .select('total_harga, total_qty, no_faktur, tanggal')
      .gte('tanggal', last7Str)
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    const hariIni = penjualan.filter(p => p.tanggal === todayStr);

    const { data: hutangData, error: e2 } = await db
      .from('tr_hutang')
      .select('*')
      .eq('status', 'belum_lunas')
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    const totalHarga = hariIni.reduce((s, r) => s + Number(r.total_harga), 0);
    const totalQty = hariIni.reduce((s, r) => s + Number(r.total_qty), 0);
    const jmlFaktur = hariIni.length;
    const totalHutang = (hutangData || []).reduce((s, h) => s + Number(h.jumlah), 0);

    container.innerHTML = `
      <div class="gap-12">

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

        <div class="card">
          <div class="sec-lbl">Grafik Tren Penjualan (7 Hari)</div>
          <canvas id="salesChart" height="150"></canvas>
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
                ${hariIni.slice(0, 5).map(p => `
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

        <div class="card" style="background:linear-gradient(135deg, #10b981, #059669);border:none;box-shadow:0 4px 15px rgba(16,185,129,0.4)">
          <div style="color:rgba(255,255,255,.9);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Total Penjualan</div>
          <div style="color:#fff;font-size:32px;font-weight:800">${fmt(totalHarga)}</div>
          <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px">${fmtDate(todayStr)}</div>
          <button style="margin-top:15px;width:100%;padding:12px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:12px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;" onclick="DASHBOARD.kirimWA(${totalHarga}, ${jmlFaktur}, ${totalQty})">
            📲 Kirim Laporan ke WA
          </button>
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div class="sec-lbl" style="margin:0">Hutang Aktif</div>
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('hutang')">Kelola Hutang →</button>
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
                    <button class="btn btn-secondary btn-sm" style="margin-top:4px;font-size:11px;padding:4px 10px" onclick="navigateTo('hutang')">Lunas →</button>
                  </div>
                </div>
              </div>`).join('')}
            ${hutangData.length > 3 ? `
              <div style="text-align:center;margin-top:4px">
                <button class="btn btn-outline" onclick="navigateTo('hutang')" style="font-size:13px;padding:10px">
                  Lihat semua ${hutangData.length} hutang →
                </button>
              </div>` : ''}
          `}
        </div>

        <div class="card" style="border-color:#fecaca;background:#fef2f2">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13px;font-weight:700;color:#991b1b">🗑️ Reset Data Hari Ini</div>
              <div style="font-size:11px;color:#dc2626;margin-top:2px">Hapus semua bon + transaksi hari ini (lokal &amp; server)</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="DASHBOARD.resetHariIni()" style="white-space:nowrap">Reset Sekarang</button>
          </div>
        </div>

      </div>`;

    _initDashboardGlobal(container);

    setTimeout(() => {
      const ctx = document.getElementById('salesChart');
      if (!ctx) return;
      const agg = {};
      for (let i = 6; i >= 0; i--) {
        const past = new Date();
        past.setDate(past.getDate() - i);
        agg[past.toISOString().slice(0, 10)] = 0;
      }
      for (let p of penjualan) {
        if (agg[p.tanggal] !== undefined) agg[p.tanggal] += Number(p.total_harga);
      }
      const labels = Object.keys(agg).map(d => {
        const pts = d.split('-');
        return pts[2] + '/' + pts[1];
      });
      if (window.Chart) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Rp', data: Object.values(agg),
              borderColor: '#10b981', tension: 0.4, fill: true,
              backgroundColor: 'rgba(16, 185, 129, 0.1)'
            }]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
          }
        });
      }
    }, 200);

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

function _initDashboardGlobal(container) {
  window.DASHBOARD = {
    async resetHariIni() {
      const todayKey = new Date().toISOString().slice(0, 10);
      const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
      const todayBon = allBon.filter(b => b.waktu && b.waktu.slice(0, 10) === todayKey);

      if (!todayBon.length && !isConfigured) {
        showToast('Tidak ada data hari ini untuk direset', 'info');
        return;
      }

      if (!confirm(`Reset SEMUA data hari ini (${todayKey})?\n\n• ${todayBon.length} bon lokal\n• Transaksi di server\n\nData tidak bisa dikembalikan!`)) return;

      const newBon = allBon.filter(b => !b.waktu || b.waktu.slice(0, 10) !== todayKey);
      localStorage.setItem('sj_bon', JSON.stringify(newBon));
      localStorage.removeItem('sj_produk_cache');

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
          showToast('Reset lokal OK, gagal hapus server: ' + err.message, 'warning');
        }
      }

      showToast('Data hari ini berhasil direset ✅', 'success');
      await renderDashboard(container);
    },

    kirimWA(totalHarga, jmlFaktur, totalQty) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const text = `*Laporan Sinar Jaya* 🛒\nTanggal: ${fmtDate(todayKey)}\n\n*Penjualan Hari Ini*\nTotal: *${fmt(totalHarga)}*\nTransaksi: ${jmlFaktur} struk\nBarang Terjual: ${totalQty} item\n\nTerima kasih! 🙏`;
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  };
}

function notConfiguredHTML() {
  return `
    <div class="cfg-warn">
      <h3>⚙️ Supabase Belum Dikonfigurasi</h3>
      <p>Edit file <code>env.js</code> dan isi <code>SUPABASE_URL</code> serta <code>SUPABASE_ANON_KEY</code>.</p>
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