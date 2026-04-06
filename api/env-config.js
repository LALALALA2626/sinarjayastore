// api/env-config.js
// Vercel Serverless Function — pengganti netlify/functions/env-config.js
// Melayani konfigurasi Supabase dari environment variable Vercel.
// Rahasia TIDAK pernah terekspos ke frontend/browser.
//
// ===== SETUP DI VERCEL DASHBOARD =====
// 1. Buka https://vercel.com → pilih project ini
// 2. Settings → Environment Variables → Add:
//      SUPABASE_URL      = https://xxxxxxxx.supabase.co
//      SUPABASE_ANON_KEY = sb_publishable_xxxx...
// =====================================

export default function handler(req, res) {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    return res.status(500).json({
      error: 'Environment variable SUPABASE_URL dan SUPABASE_ANON_KEY belum dikonfigurasi di Vercel Dashboard.',
    });
  }

  // Cache 5 menit agar tidak spam request
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ url, key });
}
