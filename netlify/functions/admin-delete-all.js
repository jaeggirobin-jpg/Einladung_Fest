import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Methode nicht erlaubt' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) return resp(500, { error: 'ADMIN_PASSWORD nicht konfiguriert.' });
  if (!token || !timingSafeEqual(token, expected)) return resp(401, { error: 'Nicht autorisiert.' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { error: 'Ungültige Anfrage' }); }

  // Zusätzliche Sicherheit: Client muss "LÖSCHEN" mitsenden
  if (payload.confirm !== 'LÖSCHEN') {
    return resp(400, { error: 'Bestätigung fehlt.' });
  }

  const { count: before } = await supabase
    .from('anmeldungen')
    .select('*', { count: 'exact', head: true });

  const { error } = await supabase
    .from('anmeldungen')
    .delete()
    .not('id', 'is', null);

  if (error) {
    console.error('Delete-all error:', error);
    return resp(500, { error: 'Löschen fehlgeschlagen: ' + error.message });
  }

  return resp(200, { ok: true, deleted: before || 0 });
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
