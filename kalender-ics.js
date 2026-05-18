/**
 * kalender-ics.js
 * ------------------------------------------------------------
 * Erzeugt die iCalendar-Datei (.ics) für den Mail-Anhang.
 * Wird in netlify/functions/submit-rsvp.js eingebunden und
 * bei jeder Zusage als Attachment mitgesendet.
 * ------------------------------------------------------------
 */

const EVENT = {
  uid:        'geschaeftsuebergabe-2026-08-31@jaeggivollmer.ch',
  start:      '20260831T170000',
  end:        '20260831T220000',
  tzid:       'Europe/Zurich',
  summary:    'Geschäftsübergabe Jäggi Vollmer GmbH',
  location:   'Horburgstrasse 96, 4057 Basel',
  description: [
    'Programm:',
    '17:00  Empfang',
    '18:30  Geschäftsübergabe',
    'Anschliessend Apéro, Abendessen und gemütlicher Ausklang',
    '',
    'Wir freuen uns auf Sie!'
  ].join('\n')
};

export function kalenderIcs() {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jaeggi Vollmer GmbH//Einladung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',

    'BEGIN:VTIMEZONE',
    `TZID:${EVENT.tzid}`,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',

    'BEGIN:VEVENT',
    `UID:${EVENT.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${EVENT.tzid}:${EVENT.start}`,
    `DTEND;TZID=${EVENT.tzid}:${EVENT.end}`,
    `SUMMARY:${escapeIcs(EVENT.summary)}`,
    `LOCATION:${escapeIcs(EVENT.location)}`,
    `DESCRIPTION:${escapeIcs(EVENT.description)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'SEQUENCE:0',
    'END:VEVENT',

    'END:VCALENDAR'
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function escapeIcs(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let i = 0;
  parts.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join('\r\n');
}
