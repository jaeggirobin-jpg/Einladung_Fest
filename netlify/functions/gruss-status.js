import { createClient } from '@supabase/supabase-js';
import { ladeFreigabe, jsonResp } from '../../gruss-shared.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Öffentlicher Status-Endpunkt für die Gäste-Seite:
 * Ist die Selfie-Station offen? Wenn nein, ab wann?
 */
export async function handler() {
  const status = await ladeFreigabe(supabase);
  return jsonResp(200, {
    offen: status.offen,
    freigabe_ab: status.offen ? null : status.freigabe_ab
  });
}
