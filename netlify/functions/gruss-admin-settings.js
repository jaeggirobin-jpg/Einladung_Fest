import { createClient } from '@supabase/supabase-js';
import { ladeFreigabe, timingSafeEqual, jsonResp } from '../../gruss-shared.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.GRUESSE_ADMIN_PASSWORD;

  if (!expected) return jsonResp(500, { error: 'GRUESSE_ADMIN_PASSWORD nicht konfiguriert.' });
  if (!token || !timingSafeEqual(token, expected)) {
    return jsonResp(401, { error: 'Nicht autorisiert.' });
  }

  // Aktuellen Stand lesen
  if (event.httpMethod === 'GET') {
    const status = await ladeFreigabe(supabase);
    return jsonResp(200, status);
  }

  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Methode nicht erlaubt' });
  }

  let data;
  try { data = JSON.parse(event.body || '{}'); }
  catch { return jsonResp(400, { error: 'Ungültige Anfrage' }); }

  const update = { updated_at: new Date().toISOString() };

  switch (data.aktion) {
    case 'sofort':
      // Jetzt freischalten, geplanten Zeitpunkt entfernen
      update.freigeschaltet = true;
      update.freigabe_ab = null;
      break;

    case 'sperren':
      // Komplett sperren, auch geplante Freigabe löschen
      update.freigeschaltet = false;
      update.freigabe_ab = null;
      break;

    case 'planen': {
      const ts = String(data.freigabe_ab || '').trim();
      const d = new Date(ts);
      if (!ts || isNaN(d.getTime())) {
        return jsonResp(400, { error: 'Bitte einen gültigen Zeitpunkt wählen.' });
      }
      update.freigeschaltet = false;
      update.freigabe_ab = d.toISOString();
      break;
    }

    default:
      return jsonResp(400, { error: 'Unbekannte Aktion.' });
  }

  const { error } = await supabase
    .from('gruss_einstellungen')
    .update(update)
    .eq('id', 1);

  if (error) {
    console.error('Settings update error:', error);
    return jsonResp(500, { error: 'Speichern fehlgeschlagen.' });
  }

  const status = await ladeFreigabe(supabase);
  return jsonResp(200, status);
}
