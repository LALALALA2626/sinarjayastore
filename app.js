// app.js — SPA Router & Navigation
import { renderDashboard } from './pages/dashboard.js?v=v7';
import { renderKasir } from './pages/kasir.js?v=v7';
import { renderMasterBarang } from './pages/master-barang.js?v=v7';
import { renderTransaksi } from './pages/transaksi.js?v=v7';
import { renderLaporan } from './pages/laporan.js?v=v7';
import { renderHutang } from './pages/hutang.js?v=v7';

const ROUTES = {
  'dashboard': renderDashboard,
  'kasir': renderKasir,
  'master-barang': renderMasterBarang,
  'transaksi': renderTransaksi,
  'laporan': renderLaporan,
  'hutang': renderHutang,
};

const PAGE_LABELS = {
  'dashboard': 'Sembako & Kelontong',
  'kasir': 'Kasir — Bon Cepat',
  'master-barang': 'Master Barang',
  'transaksi': 'Transaksi Penjualan',
  'laporan': 'Laporan Penjualan',
  'hutang': 'Hutang Pelanggan',
};

function getPage() {
  return (window.location.hash || '#dashboard').replace('#', '') || 'dashboard';
}

function updateNav(page) {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const sub = document.getElementById('page-subtitle');
  if (sub) sub.textContent = PAGE_LABELS[page] || 'Sinar Jaya';
}

async function navigate() {
  const page = getPage();
  const content = document.getElementById('page-content');
  updateNav(page);

  content.style.opacity = '0';
  await new Promise(r => setTimeout(r, 120));

  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  content.style.opacity = '1';

  const render = ROUTES[page] || ROUTES['dashboard'];
  try {
    await render(content);
  } catch (err) {
    console.error('[SPA Error]', err);
    content.innerHTML = `
      <div class="card" style="margin-top:16px">
        <div class="empty">
          <div class="empty-ico">⚠️</div>
          <div><b>Terjadi Kesalahan</b><br>
          <span style="font-size:12px;color:var(--muted)">${err.message}</span></div>
        </div>
      </div>`;
  }
}

window.navigateTo = (page) => { window.location.hash = '#' + page; };

const d = new Date();
const chip = document.getElementById('tgl-chip');
if (chip) chip.textContent = d.toLocaleDateString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric'
});

window.addEventListener('hashchange', navigate);
navigate();
