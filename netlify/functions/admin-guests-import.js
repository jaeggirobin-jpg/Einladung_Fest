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

  let payload;
  try { payload = JSON.parse(event.body); }
  catch { return resp(400, { error: 'Ungültige Anfrage' }); }

  const guests = Array.isArray(payload.guests) ? payload.guests : [];
  if (guests.length === 0) return resp(400, { error: 'Keine Gäste zum Importieren.' });
  if (guests.length > 500) return resp(400, { error: 'Maximal 500 Gäste pro Import.' });

  const created = [];
  const updated = [];
  const errors  = [];

  for (let i = 0; i < guests.length; i++) {
    const g = guests[i];
    const vorname  = String(g.vorname  || '').trim().slice(0, 100);
    const nachname = String(g.nachname || '').trim().slice(0, 100);
    const email    = String(g.email    || '').trim().toLowerCase().slice(0, 200);
    let max = parseInt(g.max_begleitpersonen, 10);
    if (isNaN(max) || max < 0) max = 0;
    if (max > 10) max = 10;

    if (!vorname || !nachname || !email) {
      errors.push({ zeile: i + 1, name: `${vorname} ${nachname}`, grund: 'Vorname, Nachname und E-Mail sind Pflicht.' });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ zeile: i + 1, name: `${vorname} ${nachname}`, grund: `Ungültige E-Mail: ${email}` });
      continue;
    }

    const { data: existing } = await supabase
      .from('anmeldungen')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabase
        .from('anmeldungen')
        .update({ vorname, nachname, max_begleitpersonen: max })
        .eq('id', existing.id);
      if (upErr) {
        errors.push({ zeile: i + 1, name: `${vorname} ${nachname}`, grund: 'Aktualisieren fehlgeschlagen.' });
      } else {
        updated.push(`${vorname} ${nachname}`);
      }
    } else {
      const { error: insErr } = await supabase
        .from('anmeldungen')
        .insert({
          vorname, nachname, email,
          max_begleitpersonen: max,
          status: 'offen',
          anzahl_begleitpersonen: 0
        });
      if (insErr) {
        errors.push({ zeile: i + 1, name: `${vorname} ${nachname}`, grund: 'Anlegen fehlgeschlagen.' });
      } else {
        created.push(`${vorname} ${nachname}`);
      }
    }
  }

  return resp(200, {
    ok: true,
    counts: { created: created.length, updated: updated.length, errors: errors.length },
    errors
  });
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
