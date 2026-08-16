import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return resp(405, { error: 'Methode nicht erlaubt' });
  }

  // Eindeutiger Pfad pro Foto: Datum-Ordner + UUID
  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${randomUUID()}.jpg`;

  const { data, error } = await supabase.storage
    .from('gruesse-fotos')
    .createSignedUploadUrl(path);

  if (error) {
    console.error('Signed upload URL error:', error);
    return resp(500, { error: 'Upload konnte nicht vorbereitet werden.' });
  }

  return resp(200, { path: data.path, url: data.signedUrl });
}

function resp(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
