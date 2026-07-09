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

  let data;
  try { data = JSON.parse(event.body); }
  catch { return resp(400, { error: 'Ungültige Anfrage' }); }

  const id     = String(data.id || '').trim();
  const status = data.status === 'abgemeldet' ? 'abgemeldet' : 'angemeldet';

  if (!/^[0-9a-f-]{36}$/i.test(id)) return resp(400, { error: 'Ungültige ID' });

  // Gast muss existieren – Limit für Begleitpersonen holen
  const { data: gast, error: lookupError } = await supabase
    .from('anmeldungen')
    .select('id, max_begleitpersonen')
    .eq('id', id)
    .maybeSingle();

  if (lookupError) {
    console.error('Lookup error:', lookupError);
    return resp(500, { error: 'Prüfung fehlgeschlagen.' });
  }
  if (!gast) return resp(404, { error: 'Gast nicht gefunden.' });

  const update = { status, bestaetigung_gesendet: false };

  if (status === 'abgemeldet') {
    update.anzahl_begleitpersonen = 0;
    update.begleitpersonen = [];
    // Name bei Absage optional stehen lassen, aber falls mitgeschickt übernehmen
    if (typeof data.vorname === 'string')  update.vorname  = data.vorname.trim().slice(0, 100);
    if (typeof data.nachname === 'string') update.nachname = data.nachname.trim().slice(0, 100);
  } else {
    const vorname  = String(data.vorname  || '').trim().slice(0, 100);
    const nachname = String(data.nachname || '').trim().slice(0, 100);
    if (!vorname || !nachname) return resp(400, { error: 'Bitte Vor- und Nachname angeben.' });

    let begleit = parseInt(data.anzahl_begleitpersonen, 10);
    if (isNaN(begleit) || begleit < 0) begleit = 0;
    const maxBegleit = gast.max_begleitpersonen ?? 0;
    if (begleit > maxBegleit) begleit = maxBegleit;

    const rawNames = Array.isArray(data.begleitpersonen) ? data.begleitpersonen : [];
    const begleitpersonen = rawNames.slice(0, begleit).map(p => ({
      vorname:  String(p?.vorname  || '').trim().slice(0, 100),
      nachname: String(p?.nachname || '').trim().slice(0, 100)
    }));

    if (begleit > 0 && (begleitpersonen.length !== begleit || begleitpersonen.some(p => !p.vorname || !p.nachname))) {
      return resp(400, { error: 'Bitte Vor- und Nachname für jede Begleitperson angeben.' });
    }

    update.vorname = vorname;
    update.nachname = nachname;
    update.anzahl_begleitpersonen = begleit;
    update.begleitpersonen = begleitpersonen;
  }

  const { error } = await supabase
    .from('anmeldungen')
    .update(update)
    .eq('id', id);

  if (error) {
    console.error('Update error:', error);
    return resp(500, { error: 'Speichern fehlgeschlagen.' });
  }

  return resp(200, { ok: true, status });
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
