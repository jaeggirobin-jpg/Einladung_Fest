/**
 * bestaetigung-mail.js
 * ------------------------------------------------------------
 * Erzeugt das HTML der Bestätigungsmail, die nach einer
 * erfolgreichen Anmeldung automatisch versendet wird.
 * Design an die Einladungsmail angeglichen (Arial, Sand-Header
 * mit "Seit 2002", eigener Programm-Block).
 * ------------------------------------------------------------
 */

import { mailLogoSrc } from './mail-logo.js';

export function bestaetigungHtml({ vorname, begleit }) {

  const anrede = 'Guten Tag';

  let b = parseInt(begleit, 10);
  if (isNaN(b) || b < 0) b = 0;
  const total = 1 + b;

  // --- Personenzahl-Text ---
  const HL = (n, w) => `<span style="font-weight:bold;color:#BF853B;">${n}&nbsp;${w}</span>`;
  let personenText;
  if (b === 0) {
    personenText =
      `Deine Anmeldung ist für ${HL(1, 'Person')} notiert.`;
  } else if (b === 1) {
    personenText =
      `Deine Anmeldung ist für ${HL(2, 'Personen')} notiert – Du und ${HL(1, 'Begleitperson')}.`;
  } else {
    personenText =
      `Deine Anmeldung ist für ${HL(total, 'Personen')} notiert – Du und ${HL(b, 'Begleitpersonen')}.`;
  }

  // --- HTML der E-Mail ---
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="de">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>Anmeldung bestätigt</title>
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; border-spacing: 0; border: 0; mso-line-height-rule: exactly; }
  table { border-collapse: collapse !important; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EFEADD; }
  a { color: inherit; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; max-width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .hero-title { font-size: 26px !important; }
    .date-big { font-size: 28px !important; }
    .hero-pad { padding: 40px 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EFEADD;font-family:Arial, Helvetica, sans-serif;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#EFEADD;">
  Deine/eure Anmeldung zur Geschäftsübergabe der Jäggi Vollmer GmbH ist eingegangen.
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#EFEADD" style="background-color:#EFEADD;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#FDFAF3" style="width:600px;max-width:600px;background-color:#FDFAF3;border-collapse:collapse;">

        <!-- Gold-Akzentlinie oben -->
        <tr>
          <td bgcolor="#C9A877" height="3" style="background-color:#C9A877;height:3px;line-height:3px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
        </tr>

        <!-- Header (Sand) mit Logo + Seit 2002 -->
        <tr>
          <td bgcolor="#E5D5B0" style="background-color:#E5D5B0;padding:32px 40px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td valign="middle">
                  <img src="${mailLogoSrc}" alt="Jäggi Vollmer – Spenglerei, Sanitär, Planung" width="260" style="display:block;width:260px;max-width:100%;height:auto;border:0;outline:none;">
                </td>
                <td valign="middle" align="right" style="color:#5A6670;font-size:11px;letter-spacing:1px;font-family:Arial, Helvetica, sans-serif;">Seit 2002</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td class="hero-pad" bgcolor="#FDFAF3" align="center" style="background-color:#FDFAF3;padding:56px 40px 24px;">
            <div style="color:#BF853B;font-size:16px;font-weight:bold;letter-spacing:8px;margin-bottom:28px;font-family:Arial, Helvetica, sans-serif;">ANMELDUNG BESTÄTIGT</div>
            <div class="hero-title" style="color:#4B575D;font-size:32px;font-weight:bold;line-height:1.2;font-family:Arial, Helvetica, sans-serif;letter-spacing:-0.5px;">Du bist dabei</div>
            <div style="width:40px;height:1px;background-color:#BF853B;margin:26px auto 0;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</div>
          </td>
        </tr>

        <!-- Anrede & Intro -->
        <tr>
          <td class="px" style="padding:8px 40px 8px;">
            <p style="color:#4B575D;font-size:16px;line-height:1.7;margin:0 0 22px;font-family:Arial, Helvetica, sans-serif;">
              ${anrede}
            </p>
            <p style="color:#4B575D;font-size:16px;line-height:1.7;margin:0 0 22px;font-family:Arial, Helvetica, sans-serif;">
              Vielen Dank für deine/eure Anmeldung zur Geschäftsübergabe der Jäggi Vollmer GmbH. Wir freuen uns sehr, dich/euch an diesem besonderen Abend begrüssen zu dürfen.
            </p>
            <p style="color:#4B575D;font-size:16px;line-height:1.7;margin:0;font-family:Arial, Helvetica, sans-serif;">
              ${personenText}
            </p>
          </td>
        </tr>

        <!-- Datum-Karte -->
        <tr>
          <td class="px" style="padding:24px 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td bgcolor="#F5EEDC" align="center" style="background-color:#F5EEDC;padding:36px 24px;border-left:3px solid #BF853B;">
                  <div style="color:#BF853B;font-size:11px;font-weight:bold;letter-spacing:4px;margin-bottom:14px;font-family:Arial, Helvetica, sans-serif;">MONTAG</div>
                  <div class="date-big" style="color:#4B575D;font-size:34px;font-weight:bold;line-height:1;font-family:Arial, Helvetica, sans-serif;letter-spacing:-0.5px;">31. August 2026</div>
                  <div style="color:#7A858D;font-size:15px;margin-top:12px;font-family:Arial, Helvetica, sans-serif;">ab 17:00 Uhr</div>
                  <div style="width:32px;height:1px;background-color:#C9A877;margin:22px auto;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</div>
                  <div style="color:#4B575D;font-size:15px;line-height:1.6;font-family:Arial, Helvetica, sans-serif;">Horburgstrasse 96<br>4057 Basel</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Programm -->
        <tr>
          <td class="px" align="center" style="padding:12px 40px 8px;">
            <div style="color:#BF853B;font-size:16px;font-weight:bold;letter-spacing:8px;margin-bottom:28px;font-family:Arial, Helvetica, sans-serif;">PROGRAMM</div>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:0 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="padding:16px 0;border-bottom:1px solid #EFE7D0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td width="110" valign="top" style="color:#BF853B;font-size:18px;font-weight:bold;font-family:Arial, Helvetica, sans-serif;">17:00</td>
                      <td valign="top" style="color:#4B575D;font-size:16px;line-height:1.5;font-family:Arial, Helvetica, sans-serif;font-weight:bold;">Apéro/Essen</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 0;border-bottom:1px solid #EFE7D0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td width="110" valign="top" style="color:#BF853B;font-size:18px;font-weight:bold;font-family:Arial, Helvetica, sans-serif;">18:30</td>
                      <td valign="top" style="color:#4B575D;font-size:16px;line-height:1.5;font-family:Arial, Helvetica, sans-serif;font-weight:bold;">Geschäftsübergabe</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td width="110" valign="top" style="color:#BF853B;font-size:15px;font-weight:bold;font-family:Arial, Helvetica, sans-serif;padding-top:2px;">danach</td>
                      <td valign="top" style="color:#4B575D;font-size:16px;line-height:1.5;font-family:Arial, Helvetica, sans-serif;font-weight:bold;">Essen/Feiern/Bar</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Dezente Trennlinie -->
        <tr>
          <td style="padding:0 40px;">
            <div style="height:1px;background-color:#C9A877;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</div>
          </td>
        </tr>

        <!-- Anhang & Verhinderung -->
        <tr>
          <td class="px" style="padding:32px 40px 8px;">
            <p style="color:#929A9D;font-size:14px;line-height:1.7;margin:0;font-family:Arial, Helvetica, sans-serif;">
              Im Anhang findest du eine Kalenderdatei (.ics), die du direkt in Outlook, Apple Kalender oder Google Calendar öffnen kannst.
            </p>
            <p style="color:#929A9D;font-size:14px;line-height:1.7;margin:14px 0 0;font-family:Arial, Helvetica, sans-serif;">
              Solltest du wider Erwarten doch verhindert sein, genügt eine kurze Antwort auf die Mail: info@jaeggivollmer.ch
            </p>
          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td class="px" style="padding:32px 40px 44px;">
            <p style="color:#4B575D;font-size:16px;line-height:1.7;margin:0;font-family:Arial, Helvetica, sans-serif;">
              Herzlich<br><br>
              <strong style="font-weight:bold;">Felix Sonja Robin Jäggi und Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer (Slate) -->
        <tr>
          <td bgcolor="#5A6670" align="center" style="background-color:#5A6670;padding:26px 40px;">
            <div style="color:#C9A877;font-size:14px;font-weight:bold;margin-bottom:10px;font-family:Arial, Helvetica, sans-serif;">Jäggi Vollmer GmbH</div>
            <div style="color:#B5BAC0;font-size:12px;line-height:1.7;font-family:Arial, Helvetica, sans-serif;">
              Horburgstrasse 96 &nbsp;&middot;&nbsp; 4057 Basel<br>
              <a href="https://jaeggivollmer.ch" style="color:#C9A877;text-decoration:none;">jaeggivollmer.ch</a>
            </div>
          </td>
        </tr>

        <!-- Gold-Akzentlinie unten -->
        <tr>
          <td bgcolor="#C9A877" height="3" style="background-color:#C9A877;height:3px;line-height:3px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}
