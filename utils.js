export const fmt     = n  => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export const fmtNum  = n  => Math.round(n).toLocaleString('id-ID');
export const today   = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric'
});

export const fmtDateShort = (d) => new Date(d).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric'
});

export const fmtDateTime = (d) => new Date(d).toLocaleString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

export function showToast(msg, type = 'success') {
  const existing = document.getElementById('sj-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'sj-toast';
  t.className = `sj-toast sj-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

export function showConfirm(msg) {
  return window.confirm(msg);
}

export function setSubtitle(text) {
  const el = document.getElementById('page-subtitle');
  if (el) el.textContent = text;
}
