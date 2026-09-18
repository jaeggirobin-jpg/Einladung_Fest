import { createClient } from '@supabase/supabase-js';
import { jsonResp, pruefeWerkstatt } from '../../gruss-shared.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'gruesse-fotos';

/**
 * Eigene Albumbilder: auflisten, anlegen, umbenennen, sortieren, löschen.
 * Jede Antwort liefert die vollständige, sortierte Liste zurück –
 * so kann die Werkstatt nach jeder Änderung einfach neu zeichnen.
 */
export async function handler(event) {
  const abgelehnt = pruefeWerkstatt(event);
  if (abgelehnt) return abgelehnt;

  if (event.httpMethod === 'GET') {
    return liefereListe();
  }
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Methode nicht erlaubt' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return jsonResp(400, { error: 'Ungültige Anfrage' }); }

  switch (body.aktion) {
    case 'anlegen':   return anlegen(body);
    case 'titel':     return titelAendern(body);
    case 'reihenfolge': return sortieren(body);
    case 'loeschen':  return loeschen(body);
    default:          return jsonResp(400, { error: 'Unbekannte Aktion.' });
  }
}

/* --- Aktionen ------------------------------------------------------- */

async function anlegen(body) {
  const fotoPath  = String(body.foto_path || '').trim();
  const thumbPath = String(body.thumb_path || '').trim() || null;

  // Nur Pfade aus dem eigenen Ordner akzeptieren
  if (!fotoPath.startsWith('album/')) {
    return jsonResp(400, { error: 'Ungültiger Bildpfad.' });
  }
  if (thumbPath && !thumbPath.startsWith('album/')) {
    return jsonResp(400, { error: 'Ungültiger Bildpfad.' });
  }

  // Neues Bild ans Ende hängen
  const { data: letzte } = await supabase
    .from('album_bilder')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);
  const position = letzte && letzte.length ? (letzte[0].position || 0) + 1 : 0;

  const { error } = await supabase.from('album_bilder').insert({
    titel: kuerze(body.titel, 120),
    foto_path: fotoPath,
    thumb_path: thumbPath,
    position
  });

  if (error) {
    console.error('Insert error:', error);
    return jsonResp(500, { error: 'Bild konnte nicht gespeichert werden.' });
  }
  return liefereListe();
}

async function titelAendern(body) {
  const id = String(body.id || '').trim();
  if (!id) return jsonResp(400, { error: 'Kein Bild angegeben.' });

  const { error } = await supabase
    .from('album_bilder')
    .update({ titel: kuerze(body.titel, 120) })
    .eq('id', id);

  if (error) {
    console.error('Update error:', error);
    return jsonResp(500, { error: 'Titel konnte nicht gespeichert werden.' });
  }
  return liefereListe();
}

async function sortieren(body) {
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (ids.length === 0) return jsonResp(400, { error: 'Keine Reihenfolge übermittelt.' });

  // Jede Zeile bekommt ihre neue Position. In Blöcken parallel,
  // damit auch dreissig Bilder in wenigen hundert Millisekunden durch sind.
  for (let i = 0; i < ids.length; i += 10) {
    const block = ids.slice(i, i + 10);
    const ergebnisse = await Promise.all(block.map((id, n) =>
      supabase.from('album_bilder').update({ position: i + n }).eq('id', id)
    ));
    const fehler = ergebnisse.find(r => r.error);
    if (fehler) {
      console.error('Sort error:', fehler.error);
      return jsonResp(500, { error: 'Reihenfolge konnte nicht gespeichert werden.' });
    }
  }
  return liefereListe();
}

async function loeschen(body) {
  const id = String(body.id || '').trim();
  if (!id) return jsonResp(400, { error: 'Kein Bild angegeben.' });

  const { data: zeile, error: leseFehler } = await supabase
    .from('album_bilder')
    .select('foto_path, thumb_path')
    .eq('id', id)
    .maybeSingle();

  if (leseFehler) {
    console.error('Select error:', leseFehler);
    return jsonResp(500, { error: 'Bild konnte nicht gelesen werden.' });
  }

  const { error } = await supabase.from('album_bilder').delete().eq('id', id);
  if (error) {
    console.error('Delete error:', error);
    return jsonResp(500, { error: 'Bild konnte nicht gelöscht werden.' });
  }

  // Dateien erst nach dem Löschen der Zeile entfernen: schlägt das fehl,
  // bleibt nur eine verwaiste Datei zurück, kein kaputter Eintrag.
  const pfade = [zeile?.foto_path, zeile?.thumb_path].filter(Boolean);
  if (pfade.length) {
    const { error: storageFehler } = await supabase.storage.from(BUCKET).remove(pfade);
    if (storageFehler) console.error('Storage remove error:', storageFehler);
  }

  return liefereListe();
}

/* --- Liste ---------------------------------------------------------- */

async function liefereListe() {
  const { data, error } = await supabase
    .from('album_bilder')
    .select('id, created_at, position, titel, foto_path, thumb_path')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Select error:', error);
    return jsonResp(500, { error: 'Bilder konnten nicht geladen werden.' });
  }

  const pfade = [...new Set(
    data.flatMap(r => [r.thumb_path, r.foto_path]).filter(Boolean)
  )];

  const urlMap = {};
  if (pfade.length) {
    const { data: signed, error: signFehler } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(pfade, 3600);
    if (!signFehler && signed) {
      for (const s of signed) if (s.signedUrl) urlMap[s.path] = s.signedUrl;
    }
  }

  const rows = data.map(r => ({
    ...r,
    thumb_url: urlMap[r.thumb_path] || urlMap[r.foto_path] || null,
    foto_url:  urlMap[r.foto_path] || null
  }));

  return jsonResp(200, { rows, count: rows.length });
}

function kuerze(wert, max) {
  const v = String(wert == null ? '' : wert).trim();
  return v ? v.slice(0, max) : null;
}
