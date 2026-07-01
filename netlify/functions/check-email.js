import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handler(event) {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Methode nicht erlaubt' });

  let data;
  try { data = JSON.parse(event.body); }
  catch { return resp(400, { error: 'Ungültige Anfrage' }); }

  const email = String(data.email || '').trim().toLowerCase().slice(0, 200);
  if (!email || !EMAIL_RE.test(email)) {
    return resp(400, { error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }

  const { data: row, error } = await supabase
    .from('anmeldungen')
    .select('vorname, nachname, status, max_begleitpersonen, anzahl_begleitpersonen, begleitpersonen')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Supabase select error:', error);
    return resp(500, { error: 'Prüfung fehlgeschlagen. Bitte später erneut versuchen.' });
  }

  if (!row) {
    return resp(200, { found: false });
  }

  return resp(200, {
    found: true,
    vorname: row.vorname,
    nachname: row.nachname,
    status: row.status,
    max_begleitpersonen: row.max_begleitpersonen ?? 0,
    anzahl_begleitpersonen: row.anzahl_begleitpersonen ?? 0,
    begleitpersonen: Array.isArray(row.begleitpersonen) ? row.begleitpersonen : []
  });
}

function resp(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
