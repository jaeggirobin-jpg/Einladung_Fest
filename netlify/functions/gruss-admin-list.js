import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual, jsonResp, werkstattPasswort, passwortDiagnose } from '../../gruss-shared.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = werkstattPasswort();

  if (!expected) {
    return jsonResp(500, {
      error: 'Passwort nicht konfiguriert. Erwartet wird WERKSTATT_PASSWORD ' +
             '(oder GRUESSE_ADMIN_PASSWORD), Scope "Functions". ' + passwortDiagnose()
    });
  }
  if (!token || !timingSafeEqual(token, expected)) {
    return jsonResp(401, { error: 'Nicht autorisiert.' });
  }

  const { data, error } = await supabase
    .from('gruesse')
    .select('id, created_at, name, nachricht, wort1, wort2, foto_path, thumb_path')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Select error:', error);
    return jsonResp(500, { error: 'Daten konnten nicht geladen werden.' });
  }

  // Signierte URLs gebündelt erzeugen:
  // Vorschaubilder für die Galerie, Originale für den Download.
  const thumbPaths = data.map(r => r.thumb_path).filter(Boolean);
  const origPaths  = data.map(r => r.foto_path).filter(Boolean);
  const alle = [...new Set([...thumbPaths, ...origPaths])];

  const urlMap = {};
  if (alle.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from('gruesse-fotos')
      .createSignedUrls(alle, 3600);
    if (!signError && signed) {
      for (const s of signed) {
        if (s.signedUrl) urlMap[s.path] = s.signedUrl;
      }
    }
  }

  const rows = data.map(r => ({
    ...r,
    // Galerie zeigt das Vorschaubild; ältere Einträge ohne Thumb nutzen das Original
    thumb_url: urlMap[r.thumb_path] || urlMap[r.foto_path] || null,
    foto_url:  urlMap[r.foto_path] || null
  }));

  return jsonResp(200, { rows, count: rows.length });
}
