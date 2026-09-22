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
    case 'aufraeumen': return aufraeumen(body);
    default:          return jsonResp(400, { error: 'Unbekannte Aktion.' });
  }
}

/* --- Fehlermeldungen ------------------------------------------------
   Der Bereich ist passwortgeschützt, deshalb darf die echte Meldung der
   Datenbank durchgereicht werden. Ohne sie bleibt nur "hat nicht
   geklappt" – und damit ist niemandem geholfen. */

function dbFehler(text, error) {
  console.error(text, error);

  // 42P01 = Tabelle gibt es nicht. Der mit Abstand häufigste Fall,
  // wenn die Migration noch nicht eingespielt wurde.
  if (error?.code === '42P01') {
    return jsonResp(500, {
      error: 'Die Tabelle album_bilder fehlt in der Datenbank. Bitte einmal ' +
             'supabase/migration_v7.sql im Supabase-SQL-Editor ausführen.',
      code: error.code
    });
  }

  const details = [error?.message, error?.details, error?.hint]
    .filter(Boolean).join(' · ');
  return jsonResp(500, {
    error: details ? `${text} (${details})` : text,
    code: error?.code || null
  });
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
  const { data: letzte, error: leseFehler } = await supabase
    .from('album_bilder')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);

  if (leseFehler) {
    await entferneDateien([fotoPath, thumbPath]);
    return dbFehler('Bild konnte nicht gespeichert werden.', leseFehler);
  }
  const position = letzte && letzte.length ? (letzte[0].position || 0) + 1 : 0;

  const { error } = await supabase.from('album_bilder').insert({
    titel: kuerze(body.titel, 120),
    foto_path: fotoPath,
    thumb_path: thumbPath,
    position
  });

  if (error) {
    // Ohne Datenbankzeile sind die hochgeladenen Dateien nur Ballast
    await entferneDateien([fotoPath, thumbPath]);
    return dbFehler('Bild konnte nicht gespeichert werden.', error);
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

  if (error) return dbFehler('Titel konnte nicht gespeichert werden.', error);
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
    if (fehler) return dbFehler('Reihenfolge konnte nicht gespeichert werden.', fehler.error);
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

  if (leseFehler) return dbFehler('Bild konnte nicht gelesen werden.', leseFehler);

  const { error } = await supabase.from('album_bilder').delete().eq('id', id);
  if (error) return dbFehler('Bild konnte nicht gelöscht werden.', error);

  // Dateien erst nach dem Löschen der Zeile entfernen: schlägt das fehl,
  // bleibt nur eine verwaiste Datei zurück, kein kaputter Eintrag.
  await entferneDateien([zeile?.foto_path, zeile?.thumb_path]);

  return liefereListe();
}

/* Dateien im Ordner album/, zu denen es keine Zeile gibt. Solche
   entstehen, wenn der Upload durchläuft, das Speichern in der Datenbank
   aber scheitert. Mit nur_zaehlen wird bloss gezählt, ohne zu löschen. */
async function aufraeumen(body) {
  const { data: zeilen, error } = await supabase
    .from('album_bilder')
    .select('foto_path, thumb_path');
  if (error) return dbFehler('Bilder konnten nicht geladen werden.', error);

  const benutzt = new Set(
    zeilen.flatMap(r => [r.foto_path, r.thumb_path]).filter(Boolean)
  );

  // Alles jünger als eine Stunde bleibt unangetastet: es könnte zu
  // einem Upload gehören, der gerade noch läuft.
  const schonze = Date.now() - 60 * 60 * 1000;
  const verwaist = [];
  let offset = 0;

  for (;;) {
    const { data: dateien, error: listeFehler } = await supabase.storage
      .from(BUCKET)
      .list('album', { limit: 100, offset });

    if (listeFehler) {
      console.error('Storage list error:', listeFehler);
      return jsonResp(500, { error: 'Der Speicher liess sich nicht durchsehen.' });
    }
    if (!dateien || dateien.length === 0) break;

    for (const d of dateien) {
      const pfad = `album/${d.name}`;
      const alter = d.created_at ? new Date(d.created_at).getTime() : 0;
      if (!benutzt.has(pfad) && alter < schonze) verwaist.push(pfad);
    }
    if (dateien.length < 100) break;
    offset += dateien.length;
  }

  if (body.nur_zaehlen) return jsonResp(200, { verwaist: verwaist.length });

  await entferneDateien(verwaist);
  return jsonResp(200, { entfernt: verwaist.length });
}

/* --- Liste ---------------------------------------------------------- */

async function liefereListe() {
  const { data, error } = await supabase
    .from('album_bilder')
    .select('id, created_at, position, titel, foto_path, thumb_path')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return dbFehler('Bilder konnten nicht geladen werden.', error);

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

/* Dateien aus dem Speicher nehmen. Fehler werden nur notiert: eine
   übrig gebliebene Datei ist lästig, aber kein Grund zum Abbruch. */
async function entferneDateien(pfade) {
  const liste = pfade.filter(Boolean);
  if (!liste.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(liste);
  if (error) console.error('Storage remove error:', error);
}

function kuerze(wert, max) {
  const v = String(wert == null ? '' : wert).trim();
  return v ? v.slice(0, max) : null;
}
