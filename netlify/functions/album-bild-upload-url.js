import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { jsonResp, pruefeWerkstatt } from '../../gruss-shared.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Signierte Upload-URLs für eigene Albumbilder.
 * Anders als bei den Gästen hängt das hier nicht an der Freischaltung,
 * sondern am Werkstatt-Passwort.
 */
export async function handler(event) {
  const abgelehnt = pruefeWerkstatt(event);
  if (abgelehnt) return abgelehnt;

  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Methode nicht erlaubt' });
  }

  // Eigener Ordner, damit die Gästefotos unberührt bleiben
  const id = randomUUID();
  const originalPath = `album/${id}.jpg`;
  const thumbPath    = `album/${id}_thumb.jpg`;

  const [orig, thumb] = await Promise.all([
    supabase.storage.from('gruesse-fotos').createSignedUploadUrl(originalPath),
    supabase.storage.from('gruesse-fotos').createSignedUploadUrl(thumbPath)
  ]);

  if (orig.error || thumb.error) {
    console.error('Signed upload URL error:', orig.error || thumb.error);
    return jsonResp(500, { error: 'Upload konnte nicht vorbereitet werden.' });
  }

  return jsonResp(200, {
    original: { path: orig.data.path,  url: orig.data.signedUrl },
    thumb:    { path: thumb.data.path, url: thumb.data.signedUrl }
  });
}
