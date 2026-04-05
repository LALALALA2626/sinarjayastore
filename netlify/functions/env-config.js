// netlify/functions/env-config.js
// Melayani konfigurasi Supabase dari environment variable Netlify.
// TIDAK pernah di-commit ke git. Aman 100%.

exports.handler = async () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Env vars tidak dikonfigurasi di Netlify Dashboard.' }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      // Cache singkat agar tidak spam request, tapi tidak terlalu lama
      'Cache-Control': 'public, max-age=300',
    },
    body: JSON.stringify({ url, key }),
  };
};
