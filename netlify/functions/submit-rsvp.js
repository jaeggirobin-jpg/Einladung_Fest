import { createClient } from '@supabase/supabase-js';
import { bestaetigungHtml } from '../../bestaetigung-mail.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return resp(405, { error: 'Methode nicht erlaubt' });
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return resp(400, { error: 'Ungültige Anfrage' });
  }

  if (data.website) {
    return resp(200, { ok: true });
  }

  const vorname  = String(data.vorname  || '').trim().slice(0, 100);
  const nachname = String(data.nachname || '').trim().slice(0, 100);
  const email    = String(data.email    || '').trim().toLowerCase().slice(0, 200);
  let begleit = parseInt(data.anzahl_begleitpersonen, 10);
  if (isNaN(begleit) || begleit < 0) begleit = 0;
  if (begleit > 10) begleit = 10;

  if (!vorname || !nachname || !email) {
    return resp(400, { error: 'Bitte alle Pflichtfelder ausfüllen.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return resp(400, { error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }

  const { error } = await supabase
    .from('anmeldungen')
    .insert({ vorname, nachname, email, anzahl_begleitpersonen: begleit });

  if (error) {
    if (error.code === '23505') {
      return resp(409, {
        error: 'Mit dieser E-Mail-Adresse besteht bereits eine Anmeldung.'
      });
    }
    console.error('Supabase insert error:', error);
    return resp(500, {
      error: 'Speichern fehlgeschlagen. Bitte später erneut versuchen.'
    });
  }

  try {
    await sendBestaetigung({ vorname, email, begleit });
    await supabase.from('anmeldungen')
      .update({ bestaetigung_gesendet: true })
      .eq('email', email);
  } catch (e) {
    console.error('Mailversand fehlgeschlagen:', e);
  }

  return resp(200, { ok: true });
}

async function sendBestaetigung({ vorname, email, begleit }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Jäggi Vollmer <info@einladung.jaeggivollmer.ch>',
      reply_to: 'info@jaeggivollmer.ch',
      to: [email],
      subject: 'Anmeldung bestätigt – Geschäftsübergabe Jäggi Vollmer',
      html: bestaetigungHtml({ vorname, begleit })
    })
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Resend-Fehler ${r.status}: ${text}`);
  }
}

function resp(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
