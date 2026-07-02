import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHUNK = 100;

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
  if (guests.length > 1000) return resp(400, { error: 'Maximal 1000 Gäste pro Import.' });

  const errors = [];
  const seen = new Map();

  // Pre-Validierung + Dedup (im Speicher, sehr schnell)
  for (let i = 0; i < guests.length; i++) {
    const g = guests[i];
    const email = String(g.email || '').trim().toLowerCase().slice(0, 200);
    let max = parseInt(g.max_begleitpersonen, 10);
    if (isNaN(max) || max < 0) max = 0;
    if (max > 10) max = 10;

    if (!email) {
      errors.push({ zeile: i + 1, name: '', grund: 'E-Mail ist Pflicht.' });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ zeile: i + 1, name: email, grund: `Ungültige E-Mail: ${email}` });
      continue;
    }
    // Bei Duplikat innerhalb der CSV: letzten max_begleitpersonen-Wert behalten
    seen.set(email, { email, max_begleitpersonen: max });
  }

  const validGuests = [...seen.values()];
  if (validGuests.length === 0) {
    return resp(200, { ok: true, counts: { created: 0, updated: 0, errors: errors.length }, errors });
  }

  // Bulk-Lookup: welche E-Mails existieren schon?  (max 4 Queries für 400 Gäste)
  const existingMap = new Map();
  for (let i = 0; i < validGuests.length; i += CHUNK) {
    const chunkEmails = validGuests.slice(i, i + CHUNK).map(g => g.email);
    const { data, error } = await supabase
      .from('anmeldungen')
      .select('id, email')
      .in('email', chunkEmails);
    if (error) {
      console.error('Supabase lookup error:', error);
      return resp(500, { error: 'Prüfung der bestehenden Einträge fehlgeschlagen.' });
    }
    for (const row of data) existingMap.set(row.email, row.id);
  }

  // Split in NEU vs. UPDATE
  const toInsert = [];
  const toUpdate = [];
  for (const g of validGuests) {
    if (existingMap.has(g.email)) {
      toUpdate.push({ id: existingMap.get(g.email), max_begleitpersonen: g.max_begleitpersonen });
    } else {
      toInsert.push({
        vorname: '',
        nachname: '',
        email: g.email,
        max_begleitpersonen: g.max_begleitpersonen,
        status: 'offen',
        anzahl_begleitpersonen: 0
      });
    }
  }

  // Bulk-INSERT (chunked, max 100 pro Query)
  let created = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from('anmeldungen').insert(chunk);
    if (error) {
      console.error('Insert error:', error);
      chunk.forEach(g => errors.push({ zeile: 0, name: g.email, grund: 'Anlegen fehlgeschlagen: ' + error.message }));
    } else {
      created += chunk.length;
    }
  }

  // Bulk-UPDATE gruppiert nach max_begleitpersonen (max ~11 Queries)
  let updated = 0;
  const byMax = new Map();
  for (const u of toUpdate) {
    if (!byMax.has(u.max_begleitpersonen)) byMax.set(u.max_begleitpersonen, []);
    byMax.get(u.max_begleitpersonen).push(u.id);
  }
  for (const [max, ids] of byMax) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunkIds = ids.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('anmeldungen')
        .update({ max_begleitpersonen: max })
        .in('id', chunkIds);
      if (error) {
        console.error('Update error:', error);
        errors.push({ zeile: 0, name: `${chunkIds.length} Einträge`, grund: 'Update fehlgeschlagen: ' + error.message });
      } else {
        updated += chunkIds.length;
      }
    }
  }

  return resp(200, {
    ok: true,
    counts: { created, updated, errors: errors.length },
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
