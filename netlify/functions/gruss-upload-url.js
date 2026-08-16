import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { ladeFreigabe, jsonResp } from '../../gruss-shared.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Methode nicht erlaubt' });
  }

  const status = await ladeFreigabe(supabase);
  if (!status.offen) {
    return jsonResp(403, { error: 'Die Selfie-Station ist noch nicht freigeschaltet.' });
  }

  // Ein Ordner pro Tag, gleiche UUID für Original und Vorschaubild
  const day = new Date().toISOString().slice(0, 10);
  const id  = randomUUID();
  const originalPath = `${day}/${id}.jpg`;
  const thumbPath    = `${day}/${id}_thumb.jpg`;

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
