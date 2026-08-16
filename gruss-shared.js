/**
 * gruss-shared.js
 * ------------------------------------------------------------
 * Gemeinsame Helfer für die Gästebuch-Functions.
 * ------------------------------------------------------------
 */

/**
 * Liest die Freischalt-Einstellungen und berechnet, ob die
 * Selfie-Seite aktuell offen ist.
 * Offen = manuell freigeschaltet ODER geplanter Zeitpunkt erreicht.
 */
export async function ladeFreigabe(supabase) {
  const { data, error } = await supabase
    .from('gruss_einstellungen')
    .select('freigeschaltet, freigabe_ab')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Einstellungen konnten nicht geladen werden:', error);
    // Im Zweifel gesperrt lassen
    return { offen: false, freigeschaltet: false, freigabe_ab: null, fehler: true };
  }

  const freigeschaltet = data?.freigeschaltet === true;
  const freigabeAb     = data?.freigabe_ab || null;
  const zeitErreicht   = freigabeAb ? Date.now() >= new Date(freigabeAb).getTime() : false;

  return {
    offen: freigeschaltet || zeitErreicht,
    freigeschaltet,
    freigabe_ab: freigabeAb,
    fehler: false
  };
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function jsonResp(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}
