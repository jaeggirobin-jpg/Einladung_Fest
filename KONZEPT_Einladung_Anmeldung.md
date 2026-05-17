# KONZEPT: Anmelde-Landingpage Geschäftsübergabe

Handoff-Dokument für Claude Code. Ziel ist eine eigenständige, moderne
Anmeldeseite für die Geschäftsübergabe der Jäggi Vollmer GmbH.

**Event:** Montag, 31. August 2026, ab 17:00 Uhr · Horburgstrasse 96, 4057 Basel
**Übergabe:** 18:30 Uhr · **Anmeldeschluss:** 1. August 2026

---

## 1. Übersicht & Ziel

Eine öffentlich erreichbare Landingpage unter `einladung.jaeggivollmer.ch`,
auf der sich Gäste anmelden können. Erfasst werden:

- Vorname (Pflicht)
- Nachname (Pflicht)
- E-Mail (Pflicht)
- Anzahl Begleitpersonen (0–10, Standard 0)

Nach dem Absenden wird die Anmeldung gespeichert und automatisch eine
gestaltete Bestätigungsmail an die angegebene Adresse versendet.

---

## 2. Architektur-Entscheidung

**Vollständig eigenständiges Projekt:** eigenes Repo, eigenes Supabase-Projekt,
eigene Netlify-Site, eigene Resend-/Absender-Konfiguration. Nichts wird mit
anderen Systemen geteilt.

Begründung: Die Anmeldung ist ein einmaliges, zeitlich begrenztes Event.
Mit komplett getrennter Infrastruktur lässt sich nach der Veranstaltung
(ab Sept. 2026) alles rückstandslos löschen, ohne andere Systeme zu berühren
(GEMA, das Kunden-Inspirationstool, die Firmenwebsite). Keine Vermischung von
Event-Daten mit produktiven Geschäfts- oder Kundendaten, keine Deployment-
Kopplung, keine geteilte Datenbank. Die saubere Entfernung nach dem Event ist
in Abschnitt 14 beschrieben.

**Gewählter Aufbau (bewusst minimal):**

```
Gast (Browser)
   │  POST Formulardaten
   ▼
Netlify Function  (submit-rsvp)        ← serverseitig, kennt die Secrets
   ├─ schreibt in ──► Supabase (Postgres, RLS dicht)
   └─ sendet via ───► Resend (Bestätigungsmail)
```

Die Landingpage spricht **nie direkt** mit Supabase. Der `anon`-Key wird
nicht für Schreibzugriffe gebraucht. Nur die Netlify Function schreibt –
mit dem Service-Role-Key, der ausschliesslich serverseitig liegt.
Da Seite und Funktion auf derselben Netlify-Domain laufen, ist kein CORS nötig.

---

## 3. Tech-Stack

| Komponente   | Technologie                                   |
|--------------|-----------------------------------------------|
| Hosting      | Netlify (statische Seite + Functions)         |
| Datenbank    | Supabase (Postgres) – nur Storage der Anmeldungen |
| Mailversand  | Resend (REST-API)                             |
| Frontend     | Vanilla JS, HTML, CSS                         |
| 3D-Hero      | Three.js (siehe Abschnitt 9)                  |

Keine Frameworks, kein Build-Tool nötig ausser dem Netlify-Functions-Bundler.

---

## 4. Repo-Struktur

```
einladung-uebergabe/
├── index.html                  Landingpage
├── css/
│   └── style.css
├── js/
│   ├── main.js                 Formular-Logik + Validierung
│   └── scene.js                Three.js 3D-Hero
├── netlify/
│   └── functions/
│       └── submit-rsvp.js      Serverless-Endpoint
├── supabase/
│   └── migration.sql           Datenbankschema
├── netlify.toml
├── package.json
└── README.md
```

---

## 5. Datenmodell (Supabase)

Datei `supabase/migration.sql` – im Supabase SQL-Editor ausführen:

```sql
-- Tabelle der Anmeldungen
create table public.anmeldungen (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  vorname                 text not null,
  nachname                text not null,
  email                   text not null,
  anzahl_begleitpersonen  smallint not null default 0,
  bemerkung               text,
  status                  text not null default 'angemeldet',
  bestaetigung_gesendet   boolean not null default false
);

-- Doppelanmeldungen pro E-Mail verhindern
create unique index anmeldungen_email_idx
  on public.anmeldungen (lower(email));

-- RLS aktivieren, KEINE öffentlichen Policies anlegen.
-- Ohne Policy hat weder anon noch authenticated Zugriff.
-- Nur der Service-Role-Key (in der Netlify Function) umgeht RLS.
alter table public.anmeldungen enable row level security;
```

Auswertung später: direkt im Supabase **Table Editor** ansehen oder als
CSV exportieren. Eine eigene Admin-Seite ist für ein einmaliges Event
nicht nötig (optional, siehe Abschnitt 12).

---

## 6. Netlify Function `submit-rsvp`

Datei `netlify/functions/submit-rsvp.js` – Referenzimplementierung:

```js
import { createClient } from '@supabase/supabase-js';

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

  // Honeypot: verstecktes Feld muss leer bleiben (Spam-Schutz)
  if (data.website) {
    return resp(200, { ok: true }); // Bot freundlich abweisen
  }

  const vorname  = String(data.vorname  || '').trim();
  const nachname = String(data.nachname || '').trim();
  const email    = String(data.email    || '').trim().toLowerCase();
  let begleit = parseInt(data.anzahl_begleitpersonen, 10);
  if (isNaN(begleit) || begleit < 0) begleit = 0;
  if (begleit > 10) begleit = 10;

  if (!vorname || !nachname || !email) {
    return resp(400, { error: 'Bitte alle Pflichtfelder ausfüllen.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return resp(400, { error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }

  // 1. In Datenbank schreiben
  const { error } = await supabase
    .from('anmeldungen')
    .insert({ vorname, nachname, email, anzahl_begleitpersonen: begleit });

  if (error) {
    if (error.code === '23505') { // unique violation
      return resp(409, {
        error: 'Mit dieser E-Mail-Adresse besteht bereits eine Anmeldung.'
      });
    }
    console.error(error);
    return resp(500, {
      error: 'Speichern fehlgeschlagen. Bitte später erneut versuchen.'
    });
  }

  // 2. Bestätigungsmail senden (Fehler hier blockieren die Anmeldung nicht)
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
      from: 'Jäggi Vollmer <einladung@jaeggivollmer.ch>',
      reply_to: 'info@jaeggivollmer.ch',
      to: [email],
      subject: 'Anmeldung bestätigt – Geschäftsübergabe Jäggi Vollmer',
      html: bestaetigungHtml({ vorname, begleit })
    })
  });
  if (!r.ok) throw new Error('Resend-Fehler ' + r.status);
}

function resp(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
```

`reply_to` auf eine echte, betreute Adresse setzen – `einladung@` muss kein
echtes Postfach sein, Antworten sollen aber irgendwo ankommen.

---

## 7. Bestätigungsmail

Funktion `bestaetigungHtml({ vorname, begleit })` in derselben Datei.
Design identisch zur Einladungsmail (Crème/Gold/Slate, DM Sans). Kurz halten.

Inhalt:

- Anrede mit Vorname
- Bestätigung: „Ihre Anmeldung ist eingegangen."
- Personenzahl: 1 + `begleit` (z.B. „2 Personen")
- Eckdaten-Block: Datum, Uhrzeit, Ort
- Hinweis: Bei Verhinderung kurze Antwort auf diese Mail

Als Vorlage kann das bestehende `einladung_uebergabe_jv.html` dienen –
auf einen einspaltigen Bestätigungs-Block reduziert. Tabellen-Layout
beibehalten (Outlook-Kompatibilität).

---

## 8. Frontend: Landingpage – Funktion

`index.html` mit Formular, `js/main.js` für Logik.

**Formularfelder** (mit Honeypot):

```html
<form id="anmeldung-form" novalidate>
  <input type="text"  id="vorname"  name="vorname"  required>
  <input type="text"  id="nachname" name="nachname" required>
  <input type="email" id="email"    name="email"    required>
  <select id="anzahl_begleitpersonen" name="anzahl_begleitpersonen">
    <option value="0">Keine Begleitperson</option>
    <option value="1">1 Begleitperson</option>
    <option value="2">2 Begleitpersonen</option>
    <!-- ... bis 10 -->
  </select>

  <!-- Honeypot: per CSS unsichtbar, für Menschen nicht ausfüllbar -->
  <input type="text" name="website" tabindex="-1" autocomplete="off"
         style="position:absolute;left:-9999px" aria-hidden="true">

  <button type="submit" id="submit-btn">Jetzt anmelden</button>
</form>
```

**Submit-Logik** (`js/main.js`):

```js
const form = document.getElementById('anmeldung-form');
const btn  = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // einfache Client-Validierung vor dem Senden
  const payload = {
    vorname:  form.vorname.value.trim(),
    nachname: form.nachname.value.trim(),
    email:    form.email.value.trim(),
    anzahl_begleitpersonen: form.anzahl_begleitpersonen.value,
    website:  form.website.value // Honeypot
  };
  if (!payload.vorname || !payload.nachname || !payload.email) {
    showError('Bitte alle Pflichtfelder ausfüllen.');
    return;
  }

  setState('submitting'); // Button deaktivieren + Spinner

  try {
    const res = await fetch('/.netlify/functions/submit-rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await res.json();

    if (res.ok) {
      setState('success'); // Formular durch Erfolgs-Panel ersetzen
    } else {
      showError(out.error || 'Es ist ein Fehler aufgetreten.');
      setState('idle');
    }
  } catch {
    showError('Verbindung fehlgeschlagen. Bitte erneut versuchen.');
    setState('idle');
  }
});
```

**Zustände der Seite:**

| Zustand     | Anzeige                                                        |
|-------------|----------------------------------------------------------------|
| idle        | Formular bereit                                                |
| submitting  | Button deaktiviert, Spinner, Felder gesperrt                   |
| success     | Formular ausgeblendet, Erfolgs-Panel: „Vielen Dank! Eine Bestätigung wurde an Ihre E-Mail-Adresse versendet." |
| error       | Rote Hinweiszeile über dem Button, Formular bleibt ausfüllbar  |

---

## 9. Design-Konzept Landingpage

Leitlinie: **einfach, modern, ein Hauch futuristisch** – aber markenkonform.
Gleiche Schrift (DM Sans) und Farbwelt wie die Einladungsmail.

### Empfohlene Richtung: dunkler Hero mit metallischem 3D-Objekt

Single-Screen-Erlebnis, kein langes Scrollen nötig:

- **Hintergrund:** dunkler Slate-Verlauf (z.B. `#2A3138 → #3D4750`).
  Der dunkle Hero lässt Gold und das 3D-Objekt edel wirken – der bewusste
  dramatische Gegenpart zur hellen Einladungsmail, gleiche Farbfamilie.
- **3D-Objekt (Three.js):** ein langsam rotierendes, low-poly **Ikosaeder**
  oder ein **Torusknoten** mit metallischem Material
  (`MeshStandardMaterial`, `metalness ~0.9`, `roughness ~0.35`) in
  Kupfer/Gold-Ton (`#BF853B`). Das nimmt thematisch das Spengler-Handwerk
  (Metallverarbeitung) und die Markenfarbe auf.
  - Sanfte Auto-Rotation um die Y-Achse
  - Leichtes Schweben (Sinus auf Y-Position)
  - Dezente Maus-Parallaxe: Objekt folgt minimal dem Cursor
  - 2–3 Lichter + dezente Environment-Map für Reflexionen
- **Formular-Karte:** Glasmorphismus – halbtransparente Karte mit
  `backdrop-filter: blur(...)`, feiner heller Rand, weicher Schatten.
  Schwebt über dem 3D-Hintergrund. Gold-Akzent auf dem Button.
- **Inhalt der Karte:** kleines Logo, Headline („Sie sind eingeladen"),
  eine Zeile mit Datum/Ort, dann die vier Formularfelder + Button.
- **Mikro-Interaktionen:** sanfte Fokus-Übergänge der Felder,
  Hover-Glow am Button, animierter Wechsel zum Erfolgs-Panel.

### Wichtig: Performance & Barrierefreiheit

- `devicePixelRatio` auf max. 2 begrenzen
- Render-Loop bei verstecktem Tab pausieren (`visibilitychange`)
- `prefers-reduced-motion` respektieren: dann Rotation stoppen oder
  statisches Bild zeigen
- Mobil: kleineres/einfacheres Objekt oder statischer Verlauf –
  Three.js nur laden, wenn sinnvoll

### Leichtere Alternative (ohne Three.js)

Falls maximal schlank gewünscht: animierter „Aurora"-Farbverlauf im
Hintergrund (CSS-Keyframes) + Glasmorphismus-Karte + ein per CSS-Transform
rotierendes Drahtgitter-Objekt. Deutlich leichter, immer noch modern.
Diese Variante kann gut zuerst in Claude Design prototypisiert werden.

---

## 10. Konfiguration & Deployment

### netlify.toml

```toml
[build]
  functions = "netlify/functions"
  publish   = "."

[functions]
  node_bundler = "esbuild"
```

### package.json (Functions-Abhängigkeit)

```json
{
  "name": "einladung-uebergabe",
  "private": true,
  "type": "module",
  "dependencies": {
    "@supabase/supabase-js": "^2"
  }
}
```

### Environment-Variablen (Netlify → Site settings → Environment)

| Variable                    | Wert                                  |
|-----------------------------|---------------------------------------|
| `SUPABASE_URL`              | aus Supabase Projekt-Settings         |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key – **niemals** ins Frontend |
| `RESEND_API_KEY`            | aus dem Resend-Dashboard              |

### Subdomain einladung.jaeggivollmer.ch

In den DNS-Einstellungen von jaeggivollmer.ch einen CNAME-Eintrag auf die
Netlify-Site setzen (genaue Zielwerte gibt Netlify unter „Domain management"
vor). Netlify stellt das TLS-Zertifikat automatisch aus.

---

## 11. Externe Konten – einmalig einzurichten

1. **Supabase:** neues Projekt anlegen. Falls die bestehende Organisation
   das Gratis-Limit (2 Projekte) erreicht hat, eine neue (ebenfalls
   kostenlose) Organisation erstellen, z.B. „Jäggi Vollmer Events".
2. **Resend:** Konto erstellen, Domain `jaeggivollmer.ch` verifizieren
   (SPF/DKIM-DNS-Einträge hinzufügen). Alternativ eine Subdomain wie
   `send.jaeggivollmer.ch` verifizieren. Danach API-Key erzeugen.
3. **Netlify:** neue Site aus dem Repo, Env-Variablen setzen, Domain binden.

Alle drei Dienste laufen für dieses Volumen im Gratis-Tarif.

---

## 12. Optionale Erweiterungen

- **Admin-Übersicht:** einfache passwortgeschützte Seite, die alle
  Anmeldungen + Personensumme anzeigt. Für ein einmaliges Event aber
  verzichtbar – Supabase Table Editor reicht.
- **Bemerkungsfeld:** optionales Freitextfeld (z.B. Allergien/Wünsche)
  – Spalte `bemerkung` ist im Schema bereits vorgesehen.
- **Cloudflare Turnstile:** zusätzlicher Bot-Schutz, falls der Link weit
  gestreut wird. Für eine private Einladung genügt der Honeypot.
- **Anmeldeschluss-Logik:** nach dem 1. August 2026 das Formular durch
  einen Hinweis ersetzen.

---

## 13. Umsetzungsreihenfolge (für Claude Code)

1. Repo + Grundstruktur (Abschnitt 4) anlegen, `netlify.toml`, `package.json`.
2. Supabase-Projekt erstellen, `migration.sql` ausführen.
3. Resend-Konto + Domainverifizierung, API-Key erzeugen.
4. Netlify Function `submit-rsvp.js` umsetzen inkl. `bestaetigungHtml`.
5. Landingpage bauen: `index.html`, `css/style.css`, `js/main.js`
   (Formular, Validierung, Zustände).
6. 3D-Hero `js/scene.js` (Three.js) – nach der empfohlenen Richtung.
7. Netlify-Deploy, Env-Variablen setzen, Subdomain binden.
8. QA-Checkliste durchgehen.

### QA-Checkliste

- [ ] Anmeldung mit gültigen Daten → Erfolgs-Panel erscheint
- [ ] Bestätigungsmail kommt an (auch Spam-Ordner prüfen)
- [ ] Eintrag erscheint in Supabase, `bestaetigung_gesendet = true`
- [ ] Pflichtfelder leer → Fehlermeldung, kein Versand
- [ ] Ungültige E-Mail → Fehlermeldung
- [ ] Gleiche E-Mail doppelt → freundlicher Hinweis (409)
- [ ] Service-Role-Key taucht **nicht** im Browser-Quelltext auf
- [ ] Seite funktioniert mobil, Ladezeit ok
- [ ] `prefers-reduced-motion` stoppt die 3D-Animation

---

## 14. Teardown nach dem Event

Da nichts mit anderen Systemen geteilt wird, lässt sich das gesamte Projekt
nach der Veranstaltung rückstandslos entfernen – ohne Auswirkungen auf GEMA,
das Kundentool oder die Firmenwebsite.

Reihenfolge:

1. **Daten sichern (falls gewünscht):** Im Supabase Table Editor die Tabelle
   `anmeldungen` als CSV exportieren, falls die Gäste-/Teilnehmerliste
   archiviert werden soll. Danach gibt es keine Kopie mehr.
2. **Netlify-Site löschen:** Site settings → Danger zone → Delete site.
   Damit verschwindet auch die Funktion `submit-rsvp`.
3. **Supabase-Projekt löschen:** Project settings → General → Delete project.
4. **Resend:** API-Key löschen. Die Domain-Verifizierung kann bleiben
   (stört nicht) oder die zugehörigen DNS-Einträge werden entfernt.
5. **DNS:** Den CNAME-Eintrag für `einladung.jaeggivollmer.ch` entfernen.
6. **Repo:** archivieren oder löschen.

Empfehlung: Schritt 1 nicht vergessen – die Anmeldedaten sind nach dem
Löschen des Supabase-Projekts unwiderruflich weg.
