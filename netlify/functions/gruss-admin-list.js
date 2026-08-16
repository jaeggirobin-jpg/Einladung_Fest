import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.GRUESSE_ADMIN_PASSWORD;

  if (!expected) return resp(500, { error: 'GRUESSE_ADMIN_PASSWORD nicht konfiguriert.' });
  if (!token || !timingSafeEqual(token, expected)) return resp(401, { error: 'Nicht autorisiert.' });

  const { data, error } = await supabase
    .from('gruesse')
    .select('id, created_at, name, nachricht, wort1, wort2, foto_path')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Select error:', error);
    return resp(500, { error: 'Daten konnten nicht geladen werden.' });
  }

  // Signierte Foto-URLs (1 Stunde gültig), gebündelt in einem Call
  let urlMap = {};
  const paths = data.map(r => r.foto_path).filter(Boolean);
  if (paths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from('gruesse-fotos')
      .createSignedUrls(paths, 3600);
    if (!signError && signed) {
      for (const s of signed) {
        if (s.signedUrl) urlMap[s.path] = s.signedUrl;
      }
    }
  }

  const rows = data.map(r => ({ ...r, foto_url: urlMap[r.foto_path] || null }));

  return resp(200, { rows, count: rows.length });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function resp(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
