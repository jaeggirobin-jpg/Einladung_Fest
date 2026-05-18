import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return resp(405, { error: 'Methode nicht erlaubt' });
  }

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) return resp(500, { error: 'ADMIN_PASSWORD nicht konfiguriert.' });
  if (!token || !timingSafeEqual(token, expected)) {
    return resp(401, { error: 'Nicht autorisiert.' });
  }

  let data;
  try { data = JSON.parse(event.body); }
  catch { return resp(400, { error: 'Ungültige Anfrage' }); }

  const id = String(data.id || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return resp(400, { error: 'Ungültige ID' });
  }

  const { error } = await supabase
    .from('anmeldungen')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase delete error:', error);
    return resp(500, { error: 'Löschen fehlgeschlagen.' });
  }

  return resp(200, { ok: true });
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
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}
