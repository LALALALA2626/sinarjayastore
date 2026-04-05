// supabase.js
// env.js sudah diload di <head> sebelum module ini di-evaluate,
// sehingga window.SUPABASE_URL & window.SUPABASE_ANON_KEY sudah tersedia.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const url = window.SUPABASE_URL || '';
const key = window.SUPABASE_ANON_KEY || '';

export const isConfigured = (
  url.startsWith('https://') &&
  !url.includes('YOUR_PROJECT_ID') &&
  key.length > 20 &&
  !key.includes('YOUR_ANON_KEY')
);

export const db = isConfigured ? createClient(url, key) : null;

