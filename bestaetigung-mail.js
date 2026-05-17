/**
 * bestaetigung-mail.js
 * ------------------------------------------------------------
 * Erzeugt das HTML der Bestätigungsmail, die nach einer
 * erfolgreichen Anmeldung automatisch versendet wird.
 *
 * Verwendung in netlify/functions/submit-rsvp.js:
 *
 *   import { bestaetigungHtml } from './bestaetigung-mail.js';
 *   ...
 *   html: bestaetigungHtml({ vorname, begleit })
 *
 * Alternativ kann die Funktion auch direkt in submit-rsvp.js
 * eingefügt werden – dann den import-Befehl weglassen.
 * ------------------------------------------------------------
 */

export function bestaetigungHtml({ vorname, begleit }) {

  // --- Eingaben absichern ---
  const v = String(vorname || '').replace(/[<>&]/g, '').trim();
  const anrede = v ? `Guten Tag ${v}` : 'Guten Tag';

  let b = parseInt(begleit, 10);
  if (isNaN(b) || b < 0) b = 0;
  const total = 1 + b;

  // --- Personenzahl-Text ---
  let personenText;
  if (b === 0) {
    personenText =
      'Ihre Anmeldung ist für <span style="font-weight:500;">1 Person</span> notiert.';
  } else if (b === 1) {
    personenText =
      'Ihre Anmeldung ist für <span style="font-weight:500;">2 Personen</span> notiert – Sie und 1 Begleitperson.';
  } else {
    personenText =
      `Ihre Anmeldung ist für <span style="font-weight:500;">${total} Personen</span> notiert – Sie und ${b} Begleitpersonen.`;
  }

  // --- HTML der E-Mail ---
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="de">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Anmeldung bestätigt</title>
<style type="text/css">
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EFEADD; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; max-width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#EFEADD; font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EFEADD;">
  Ihre Anmeldung zur Geschäftsübergabe der Jäggi Vollmer GmbH ist eingegangen.
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#EFEADD;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px; background-color:#FDFAF3;">

        <tr><td style="background-color:#C9A877; height:3px; line-height:3px; font-size:0;">&nbsp;</td></tr>

        <tr>
          <td style="background-color:#E5D5B0; padding:28px 40px;">
            <div style="font-size:28px; font-weight:700; line-height:1; letter-spacing:-0.5px;">
              <span style="color:#BF853B;">Jäggi</span> <span style="color:#8A8E94;">Vollmer</span>
            </div>
            <div style="color:#5A6670; font-size:12px; margin-top:10px; letter-spacing:1.5px; font-weight:400;">Spenglerei &nbsp;|&nbsp; Sanitär &nbsp;|&nbsp; Planung</div>
          </td>
        </tr>

        <tr>
          <td style="background-color:#F5EEDC; padding:44px 40px;" align="center">
            <div style="color:#BF853B; font-size:11px; font-weight:500; letter-spacing:4px; margin-bottom:14px;">ANMELDUNG BESTÄTIGT</div>
            <div style="color:#4B575D; font-size:28px; font-weight:500; line-height:1.2; letter-spacing:-0.3px;">Sie sind dabei</div>
            <div style="width:40px; height:1px; background-color:#BF853B; margin:24px auto 0; font-size:0; line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <tr>
          <td class="px" style="background-color:#FDFAF3; padding:40px 40px 8px;">
            <p style="color:#4B575D; font-size:16px; line-height:1.75; margin:0;">${anrede}</p>
            <p style="color:#4B575D; font-size:16px; line-height:1.75; margin:20px 0 0;">
              Vielen Dank für Ihre Anmeldung zur Geschäftsübergabe der Jäggi Vollmer GmbH. Wir freuen uns sehr, Sie an diesem besonderen Abend begrüssen zu dürfen.
            </p>
            <p style="color:#4B575D; font-size:16px; line-height:1.75; margin:20px 0 0;">${personenText}</p>
          </td>
        </tr>

        <tr>
          <td class="px" style="background-color:#FDFAF3; padding:24px 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="background-color:#F5EEDC; padding:32px 24px; border-left:3px solid #BF853B;" align="center">
                  <div style="color:#BF853B; font-size:11px; font-weight:500; letter-spacing:4px; margin-bottom:12px;">MONTAG</div>
                  <div style="color:#4B575D; font-size:32px; font-weight:500; line-height:1; letter-spacing:-0.5px;">31. August 2026</div>
                  <div style="color:#7A858D; font-size:15px; margin-top:10px;">ab 17:00 Uhr &middot; Übergabe um 18:30 Uhr</div>
                  <div style="width:32px; height:1px; background-color:#C9A877; margin:20px auto; font-size:0; line-height:0;">&nbsp;</div>
                  <div style="color:#4B575D; font-size:15px; line-height:1.6;">Horburgstrasse 96<br>4057 Basel</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="px" style="background-color:#FDFAF3; padding:0 40px 8px;">
            <p style="color:#929A9D; font-size:14px; line-height:1.7; margin:0;">
              Sollten Sie wider Erwarten doch verhindert sein, genügt eine kurze Antwort auf diese E-Mail.
            </p>
          </td>
        </tr>

        <tr>
          <td class="px" style="background-color:#FDFAF3; padding:32px 40px 44px;">
            <p style="color:#4B575D; font-size:16px; line-height:1.75; margin:0;">
              Mit herzlichen Grüssen<br><br>
              <span style="font-weight:500;">Familie Jäggi</span><br>
              <span style="color:#929A9D;">und das Team von Jäggi Vollmer GmbH</span>
            </p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#5A6670; padding:28px 40px;" align="center">
            <div style="color:#C9A877; font-size:14px; font-weight:500; margin-bottom:10px;">Jäggi Vollmer GmbH</div>
            <div style="color:#B5BAC0; font-size:12px; line-height:1.7;">
              Horburgstrasse 96 &nbsp;&middot;&nbsp; 4057 Basel<br>
              <a href="https://jaeggivollmer.ch" style="color:#C9A877; text-decoration:none;">jaeggivollmer.ch</a>
            </div>
          </td>
        </tr>

        <tr><td style="background-color:#C9A877; height:3px; line-height:3px; font-size:0;">&nbsp;</td></tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}
