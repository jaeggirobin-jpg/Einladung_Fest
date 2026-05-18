import { createClient } from '@supabase/supabase-js';
import { bestaetigungHtml } from '../../bestaetigung-mail.js';
import { kalenderIcs }      from '../../kalender-ics.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const status   = data.status === 'abgemeldet' ? 'abgemeldet' : 'angemeldet';

  let begleit = parseInt(data.anzahl_begleitpersonen, 10);
  if (isNaN(begleit) || begleit < 0) begleit = 0;
  if (begleit > 10) begleit = 10;
  if (status === 'abgemeldet') begleit = 0;

  if (!vorname || !nachname || !email) {
    return resp(400, { error: 'Bitte alle Pflichtfelder ausfüllen.' });
  }
  if (!EMAIL_RE.test(email)) {
    return resp(400, { error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }

  const { error: upsertError } = await supabase
    .from('anmeldungen')
    .upsert(
      {
        vorname,
        nachname,
        email,
        anzahl_begleitpersonen: begleit,
        status,
        bestaetigung_gesendet: false
      },
      { onConflict: 'email' }
    );

  if (upsertError) {
    console.error('Supabase upsert error:', upsertError);
    return resp(500, {
      error: 'Speichern fehlgeschlagen. Bitte später erneut versuchen.'
    });
  }

  if (status === 'angemeldet') {
    try {
      await sendBestaetigung({ vorname, email, begleit });
      await supabase.from('anmeldungen')
        .update({ bestaetigung_gesendet: true })
        .eq('email', email);
    } catch (e) {
      console.error('Mailversand fehlgeschlagen:', e);
    }
  }

  return resp(200, { ok: true, status });
}

async function sendBestaetigung({ vorname, email, begleit }) {
  const icsBase64 = Buffer.from(kalenderIcs(), 'utf8').toString('base64');

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
      html: bestaetigungHtml({ vorname, begleit }),
      attachments: [
        {
          filename: 'geschaeftsuebergabe-jaeggi-vollmer.ics',
          content: icsBase64,
          content_type: 'text/calendar; charset=utf-8; method=PUBLISH'
        }
      ]
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
