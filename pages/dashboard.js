// pages/dashboard.js
import { db, isConfigured } from '../supabase.js';
import { fmt, today, fmtDate, showToast, buildStrukText } from '../utils.js';

let _dashPeriod = 'today'; // 'today' | 'week' | 'month'

export async function renderDashboard(container, period) {
  if (period) _dashPeriod = period;

  if (!isConfigured) {
    container.innerHTML = notConfiguredHTML() + dashboardSkeletonHTML();
    return;
  }

  container.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const todayStr = today();

    // Compute date range based on period
    let fromStr;
    let periodLabel;
    if (_dashPeriod === 'month') {
      fromStr = todayStr.slice(0, 7) + '-01';
      periodLabel = 'Bulan Ini';
    } else if (_dashPeriod === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
      fromStr = d.toISOString().slice(0, 10);
      periodLabel = 'Minggu Ini';
    } else {
      fromStr = todayStr;
      periodLabel = 'Hari Ini';
    }

    const chartFrom = new Date();
    chartFrom.setDate(chartFrom.getDate() - 6);
    const chartFromStr = chartFrom.toISOString().slice(0, 10);

    const { data: penjualan, error: e1 } = await db
      .from('tr_penjualan')
      .select('total_harga, total_qty, no_faktur, tanggal')
      .gte('tanggal', _dashPeriod === 'today' ? chartFromStr : fromStr)
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    const periodData = penjualan.filter(p => p.tanggal >= fromStr && p.tanggal <= todayStr);
    const chartData  = penjualan.filter(p => p.tanggal >= chartFromStr);

    const { data: hutangData, error: e2 } = await db
      .from('tr_hutang')
      .select('*')
      .eq('status', 'belum_lunas')
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    const totalHarga = periodData.reduce((s, r) => s + Number(r.total_harga), 0);
    const totalQty   = periodData.reduce((s, r) => s + Number(r.total_qty), 0);
    const jmlFaktur  = periodData.length;
    const totalHutang = (hutangData || []).reduce((s, h) => s + Number(h.jumlah), 0);

    // Overdue hutang (> 7 hari)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
    const overdueCount = (hutangData || []).filter(h => h.tanggal && h.tanggal < sevenDaysAgoStr).length;

    // Average per day
    const dayCount = _dashPeriod === 'today' ? 1
      : _dashPeriod === 'week' ? Math.max(1, (new Date(todayStr) - new Date(fromStr)) / 86400000 + 1)
      : Math.max(1, new Date(todayStr).getDate());
    const avgPerDay = jmlFaktur / dayCount;

    // Top produk dari cache
    let topProduk = null;
    try {
      const cache = JSON.parse(localStorage.getItem('sj_produk_cache') || '[]');
      if (cache.length) topProduk = cache.sort((a,b) => (b.hitungPakai||0) - (a.hitungPakai||0))[0];
    } catch {}

    // Last bon for cetak ulang
    const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
    const lastBon = allBon.length ? allBon[allBon.length - 1] : null;

    // hariIni alias for chart (still needed)
    const hariIni = penjualan.filter(p => p.tanggal === todayStr);

    container.innerHTML = `
      <div class="gap-12">

        <!-- Period Toggle -->
        <div class="period-pills">
          <button class="period-pill${_dashPeriod==='today'?' active':''}" onclick="DASHBOARD.setPeriod('today')">Hari Ini</button>
          <button class="period-pill${_dashPeriod==='week'?' active':''}"  onclick="DASHBOARD.setPeriod('week')">Minggu Ini</button>
          <button class="period-pill${_dashPeriod==='month'?' active':''}" onclick="DASHBOARD.setPeriod('month')">Bulan Ini</button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-lbl">Penjualan ${periodLabel}</div>
            <div class="stat-val">${fmt(totalHarga)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-lbl">Total qty terjual</div>
            <div class="stat-val">${totalQty.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div class="card">
          <div class="sec-lbl">Ringkasan — ${periodLabel} · ${fmtDate(todayStr)}</div>
          <div class="stats-grid" style="margin-bottom:0">
            <div style="text-align:center">
              <div style="font-size:28px;font-weight:800;color:var(--green)">${jmlFaktur}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">Transaksi</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:28px;font-weight:800;color:var(--green)">${Number(avgPerDay.toFixed(1)).toLocaleString('id-ID')}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">Rata-rata/hari</div>
            </div>
          </div>
          ${topProduk ? `<div style="margin-top:10px;padding:8px 10px;background:var(--green-light);border-radius:10px;font-size:12px;color:var(--green-dark)">
            ⭐ Produk terlaris: <b>${_esc(topProduk.nama)}</b> (${topProduk.hitungPakai||0}x)</div>` : ''}
        </div>

        ${lastBon ? `<div class="card" style="padding:12px 14px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--muted)">Bon Terakhir</div>
              <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:2px">${_esc(lastBon.namaPelanggan)}</div>
              <div style="font-size:11px;color:var(--muted);font-family:monospace">${lastBon.noFaktur}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:16px;font-weight:800;color:var(--green)">${fmt(lastBon.total)}</div>
              <button class="btn btn-secondary btn-sm" style="margin-top:4px;font-size:11px" onclick="DASHBOARD.cetakUlangTerakhir()">🔁 Cetak Ulang</button>
            </div>
          </div>
        </div>` : ''}

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
                  <div style="font-size:11px;color:#dc2626;margin-top:2px">${hutangData.length} pelanggan belum lunas${overdueCount > 0 ? ` &bull; <b>${overdueCount} lewat 7 hari ⚠️</b>` : ''}</div>
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
      for (let p of chartData) {
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
    async setPeriod(p) {
      await renderDashboard(container, p);
    },

    cetakUlangTerakhir() {
      const allBon = JSON.parse(localStorage.getItem('sj_bon') || '[]');
      if (!allBon.length) { showToast('Belum ada bon tersimpan', 'info'); return; }
      const bon = allBon[allBon.length - 1];
      const struktxt = buildStrukText({
        noFaktur: bon.noFaktur, tanggal: bon.waktu,
        namaPelanggan: bon.namaPelanggan, catatan: bon.catatan,
        items: bon.items, total: bon.total, metode: bon.metode,
        bayar: bon.bayar, kembali: bon.kembali,
      });
      const safeTxt = struktxt.replace(/`/g, "'");
      const mc = document.getElementById('modal-container');
      mc.innerHTML = `
        <div class="modal-backdrop" onclick="this.parentElement.innerHTML=''">
          <div class="modal-sheet" onclick="event.stopPropagation()">
            <div class="drag-bar"></div>
            <div class="sheet-title">🔁 Cetak Ulang Bon Terakhir</div>
            <div style="text-align:center;overflow-x:auto;margin-bottom:14px">
              <div style="display:inline-block;font-family:'Courier New',monospace;background:#fff;border-radius:10px;padding:18px 16px;font-size:13px;line-height:1.8;color:#1a1a1a;border:1px solid #e5e7eb">
                <div style="white-space:pre;text-align:left">${struktxt}</div>
              </div>
            </div>
            <button class="btn btn-secondary" style="margin-bottom:8px" onclick="window.open('https://wa.me/?text='+encodeURIComponent(\`${safeTxt}\`),'_blank')">💬 Bagikan ke WhatsApp</button>
            <button class="btn btn-outline" onclick="document.getElementById('modal-container').innerHTML=''">Tutup</button>
          </div>
        </div>`;
    },

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