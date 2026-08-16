import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PATH_RE = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.jpg$/i;

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return resp(405, { error: 'Methode nicht erlaubt' });
  }

  let data;
  try { data = JSON.parse(event.body); }
  catch { return resp(400, { error: 'Ungültige Anfrage' }); }

  if (data.website) return resp(200, { ok: true }); // Honeypot

  const name      = String(data.name      || '').trim().slice(0, 100);
  const nachricht = String(data.nachricht || '').trim().slice(0, 1000);
  const wort1     = String(data.wort1     || '').trim().slice(0, 30);
  const wort2     = String(data.wort2     || '').trim().slice(0, 30);
  const fotoPath  = String(data.foto_path || '').trim();

  if (!name)      return resp(400, { error: 'Bitte deinen Namen angeben.' });
  if (!nachricht) return resp(400, { error: 'Bitte eine Nachricht schreiben.' });
  if (!PATH_RE.test(fotoPath)) {
    return resp(400, { error: 'Bitte zuerst ein Selfie aufnehmen.' });
  }

  // Prüfen, dass das Foto wirklich hochgeladen wurde
  const dir  = fotoPath.split('/')[0];
  const file = fotoPath.split('/')[1];
  const { data: files, error: listError } = await supabase.storage
    .from('gruesse-fotos')
    .list(dir, { search: file });

  if (listError || !files || files.length === 0) {
    return resp(400, { error: 'Foto-Upload unvollständig. Bitte Selfie erneut aufnehmen.' });
  }

  const { error } = await supabase
    .from('gruesse')
    .insert({ name, nachricht, wort1: wort1 || null, wort2: wort2 || null, foto_path: fotoPath });

  if (error) {
    console.error('Insert error:', error);
    return resp(500, { error: 'Speichern fehlgeschlagen. Bitte erneut versuchen.' });
  }

  return resp(200, { ok: true });
}

function resp(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
