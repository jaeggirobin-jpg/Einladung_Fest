import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return resp(500, { error: 'ADMIN_PASSWORD nicht konfiguriert.' });
  }
  if (!token || !timingSafeEqual(token, expected)) {
    return resp(401, { error: 'Nicht autorisiert.' });
  }

  const { data, error } = await supabase
    .from('anmeldungen')
    .select('id, created_at, updated_at, vorname, nachname, email, anzahl_begleitpersonen, max_begleitpersonen, status, bestaetigung_gesendet')
    .order('nachname', { ascending: true });

  if (error) {
    console.error('Supabase select error:', error);
    return resp(500, { error: 'Daten konnten nicht geladen werden.' });
  }

  const stats = {
    offen:       data.filter(r => r.status === 'offen').length,
    angemeldet:  data.filter(r => r.status === 'angemeldet').length,
    abgemeldet:  data.filter(r => r.status === 'abgemeldet').length,
    personen_total: data
      .filter(r => r.status === 'angemeldet')
      .reduce((sum, r) => sum + 1 + (r.anzahl_begleitpersonen || 0), 0)
  };

  return resp(200, { rows: data, stats });
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
