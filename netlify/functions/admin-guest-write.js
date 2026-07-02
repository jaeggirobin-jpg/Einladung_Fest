import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handler(event) {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Methode nicht erlaubt' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) return resp(500, { error: 'ADMIN_PASSWORD nicht konfiguriert.' });
  if (!token || !timingSafeEqual(token, expected)) return resp(401, { error: 'Nicht autorisiert.' });

  let data;
  try { data = JSON.parse(event.body); }
  catch { return resp(400, { error: 'Ungültige Anfrage' }); }

  const id       = String(data.id || '').trim();
  const email    = String(data.email    || '').replace(/\s+/g, '').toLowerCase().slice(0, 200);

  let max = parseInt(data.max_begleitpersonen, 10);
  if (isNaN(max) || max < 0) max = 0;
  if (max > 10) max = 10;

  if (!email) {
    return resp(400, { error: 'Bitte eine E-Mail-Adresse angeben.' });
  }
  if (!EMAIL_RE.test(email)) {
    return resp(400, { error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }

  // Update bestehender Gast (nur E-Mail und Max Begleit – Name wird nicht überschrieben)
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return resp(400, { error: 'Ungültige ID' });

    const { data: clash } = await supabase
      .from('anmeldungen')
      .select('id')
      .eq('email', email)
      .neq('id', id)
      .maybeSingle();
    if (clash) return resp(409, { error: 'Diese E-Mail-Adresse ist schon einem anderen Gast zugewiesen.' });

    const { error } = await supabase
      .from('anmeldungen')
      .update({ email, max_begleitpersonen: max })
      .eq('id', id);
    if (error) {
      console.error('Supabase update error:', error);
      return resp(500, { error: 'Speichern fehlgeschlagen.' });
    }
    return resp(200, { ok: true, mode: 'updated' });
  }

  // Neuer Gast – Name bleibt initial leer, wird vom Gast selbst gesetzt
  const { error } = await supabase
    .from('anmeldungen')
    .insert({
      vorname: '',
      nachname: '',
      email,
      max_begleitpersonen: max,
      status: 'offen',
      anzahl_begleitpersonen: 0
    });
  if (error) {
    if (error.code === '23505') {
      return resp(409, { error: 'Diese E-Mail-Adresse ist bereits in der Gästeliste.' });
    }
    console.error('Supabase insert error:', error);
    return resp(500, { error: 'Anlegen fehlgeschlagen.' });
  }
  return resp(200, { ok: true, mode: 'created' });
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
