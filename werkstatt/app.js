/* ===================================================================
   Album-Werkstatt – Login, Galerie, CSV-Export
   =================================================================== */

const STORAGE_KEY = 'jv_gruss_token'; // bewusst anderer Key als das Haupt-Admin

const loginScreen = document.getElementById('login');
const loginForm   = document.getElementById('login-form');
const passwordIn  = document.getElementById('password');
const loginErr    = document.getElementById('login-error');

const dashboard   = document.getElementById('dashboard');
const refreshBtn  = document.getElementById('refresh-btn');
const csvBtn      = document.getElementById('csv-btn');
const logoutBtn   = document.getElementById('logout-btn');
const gallery     = document.getElementById('gallery');
const countLine   = document.getElementById('count-line');

const albumBtn     = document.getElementById('album-btn');
const albumModal   = document.getElementById('album-modal');
const albumListe   = document.getElementById('album-liste');
const albumWidmung = document.getElementById('album-widmung');
const albumAlle    = document.getElementById('album-alle');
const albumRun     = document.getElementById('album-run');
const albumError   = document.getElementById('album-error');

let albumLogo = null;   // Logo einmal geladen, in Originalfarben

const WIDMUNG_VORLAGE =
  'Liebe Mama, lieber Papa\n\n' +
  'Am 31. August 2026 habt ihr die Jäggi Vollmer GmbH in meine Hände gelegt – ' +
  'nach 24 Jahren, in denen ihr aus einer Idee ein Unternehmen gemacht habt.\n\n' +
  'An diesem Abend haben eure Gäste ein Selfie gemacht und aufgeschrieben, ' +
  'was sie euch mitgeben möchten. Daraus ist dieses Album entstanden.\n\n' +
  'Danke für alles.';

const statusBadge  = document.getElementById('status-badge');
const statusHint   = document.getElementById('status-hint');
const unlockBtn    = document.getElementById('unlock-btn');
const lockBtn      = document.getElementById('lock-btn');
const scheduleIn   = document.getElementById('schedule-input');
const scheduleBtn  = document.getElementById('schedule-btn');
const settingsErr  = document.getElementById('settings-error');

let allRows = [];

const saved = sessionStorage.getItem(STORAGE_KEY);
if (saved) enterDashboard();

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = passwordIn.value.trim();
  if (!pw) return;
  loginErr.hidden = true;
  try {
    const data = await fetchData(pw);
    sessionStorage.setItem(STORAGE_KEY, pw);
    enterDashboard(data);
  } catch (err) {
    loginErr.textContent = err.message;
    loginErr.hidden = false;
    passwordIn.select();
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(STORAGE_KEY);
  location.reload();
});

refreshBtn.addEventListener('click', async () => {
  await loadAndRender();
  await ladeEinstellungen();
});
csvBtn.addEventListener('click', exportCsv);

async function fetchData(token) {
  const res = await fetch('/.netlify/functions/gruss-admin-list', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 401) throw new Error('Falsches Passwort.');
  if (!res.ok) {
    const out = await res.json().catch(() => ({}));
    throw new Error(out.error || `Fehler ${res.status}`);
  }
  return res.json();
}

async function loadAndRender() {
  const token = sessionStorage.getItem(STORAGE_KEY);
  if (!token) return;
  try {
    const data = await fetchData(token);
    applyData(data);
  } catch (err) {
    if (err.message === 'Falsches Passwort.') {
      sessionStorage.removeItem(STORAGE_KEY);
      location.reload();
      return;
    }
    alert(err.message);
  }
}

async function enterDashboard(preloaded) {
  loginScreen.hidden = true;
  dashboard.hidden = false;
  if (preloaded) applyData(preloaded);
  else await loadAndRender();
  await ladeEinstellungen();
}

/* --- Freischaltung -------------------------------------------------- */

unlockBtn.addEventListener('click', () => speichereEinstellung({ aktion: 'sofort' }));
lockBtn.addEventListener('click',   () => speichereEinstellung({ aktion: 'sperren' }));
scheduleBtn.addEventListener('click', () => {
  const val = scheduleIn.value;
  if (!val) return zeigeSettingsFehler('Bitte einen Zeitpunkt wählen.');
  // datetime-local ist lokale Zeit -> ISO mit Zeitzone des Browsers
  speichereEinstellung({ aktion: 'planen', freigabe_ab: new Date(val).toISOString() });
});

async function ladeEinstellungen() {
  const token = sessionStorage.getItem(STORAGE_KEY);
  if (!token) return;
  try {
    const res = await fetch('/.netlify/functions/gruss-admin-settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Status konnte nicht geladen werden.');
    zeigeEinstellungen(await res.json());
  } catch (err) {
    zeigeSettingsFehler(err.message);
  }
}

async function speichereEinstellung(payload) {
  const token = sessionStorage.getItem(STORAGE_KEY);
  if (!token) return;
  settingsErr.hidden = true;
  [unlockBtn, lockBtn, scheduleBtn].forEach(b => b.disabled = true);
  try {
    const res = await fetch('/.netlify/functions/gruss-admin-settings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Fehler ${res.status}`);
    zeigeEinstellungen(out);
  } catch (err) {
    zeigeSettingsFehler(err.message);
  } finally {
    [unlockBtn, lockBtn, scheduleBtn].forEach(b => b.disabled = false);
  }
}

function zeigeEinstellungen(s) {
  settingsErr.hidden = true;
  statusBadge.className = 'status-badge';

  if (s.offen) {
    statusBadge.textContent = 'Freigeschaltet';
    statusBadge.classList.add('status-badge--open');
    statusHint.textContent = 'Die Gäste können jetzt Selfies und Nachrichten hinterlassen.';
  } else if (s.freigabe_ab) {
    const d = new Date(s.freigabe_ab);
    statusBadge.textContent = 'Geplant';
    statusBadge.classList.add('status-badge--planned');
    statusHint.textContent =
      `Öffnet automatisch am ${d.toLocaleDateString('de-CH', { day: '2-digit', month: 'long' })} um ` +
      `${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr.`;
    scheduleIn.value = toLocalInputValue(d);
  } else {
    statusBadge.textContent = 'Gesperrt';
    statusBadge.classList.add('status-badge--locked');
    statusHint.textContent = 'Die Gäste sehen den Willkommens-Screen mit dem Hinweis auf später.';
  }
}

function toLocalInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function zeigeSettingsFehler(msg) {
  settingsErr.textContent = msg;
  settingsErr.hidden = false;
}

function applyData({ rows }) {
  allRows = rows || [];
  countLine.textContent = `${allRows.length} ${allRows.length === 1 ? 'Gruss' : 'Grüsse'} eingegangen`;
  render();
}

function render() {
  if (allRows.length === 0) {
    gallery.innerHTML = `<p class="empty">Noch keine Grüsse eingegangen.</p>`;
    return;
  }
  gallery.innerHTML = allRows.map(cardHtml).join('');
}

function cardHtml(r) {
  // Galerie zeigt das kleine Vorschaubild, der Download liefert das Original
  const foto = r.thumb_url
    ? `<div class="gruss-card__foto"><img src="${esc(r.thumb_url)}" alt="Selfie von ${esc(r.name)}" loading="lazy"></div>`
    : `<div class="gruss-card__foto gruss-card__foto--missing">Foto fehlt</div>`;
  const words = [r.wort1, r.wort2].filter(Boolean)
    .map(w => `<span class="word-chip">${esc(w)}</span>`).join('');
  const dl = r.foto_url
    ? `<a class="gruss-card__dl" href="${esc(r.foto_url)}" download target="_blank" rel="noopener">Original herunterladen</a>`
    : '';
  return `
    <article class="gruss-card">
      ${foto}
      <div class="gruss-card__body">
        <p class="gruss-card__name">${esc(r.name)}</p>
        <p class="gruss-card__date">${formatDate(r.created_at)}</p>
        <p class="gruss-card__msg">${esc(r.nachricht)}</p>
        ${words ? `<div class="gruss-card__words">${words}</div>` : ''}
        ${dl}
      </div>
    </article>
  `;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* --- CSV ------------------------------------------------------------ */

function exportCsv() {
  const cols = ['Name', 'Nachricht', 'Wort 1', 'Wort 2', 'Zeitpunkt', 'Foto-Datei'];
  const lines = [cols.join(';')];
  allRows.forEach(r => {
    lines.push([
      csvCell(r.name),
      csvCell(r.nachricht),
      csvCell(r.wort1),
      csvCell(r.wort2),
      r.created_at ? new Date(r.created_at).toLocaleString('de-CH') : '',
      csvCell(r.foto_path)
    ].join(';'));
  });
  const csv = '﻿' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `gruesse_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(s) {
  const v = String(s || '');
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/* ===================================================================
   Fotoalbum: Auswahl und Druckdokument (A4 quer, ein Gruss pro Seite)
   =================================================================== */

albumBtn.addEventListener('click', oeffneAlbumModal);
albumModal.addEventListener('click', (e) => { if (e.target.dataset.close) albumModal.hidden = true; });
albumRun.addEventListener('click', erzeugeAlbum);
albumAlle.addEventListener('click', () => {
  const alle = [...albumListe.querySelectorAll('input[type=checkbox]')];
  const zielZustand = alle.some(c => !c.checked);
  alle.forEach(c => { c.checked = zielZustand; });
  albumAlle.textContent = zielZustand ? 'Alle abwählen' : 'Alle auswählen';
  aktualisiereAlbumZahl();
});

async function oeffneAlbumModal() {
  albumError.hidden = true;
  if (allRows.length === 0) {
    albumError.textContent = 'Es sind noch keine Grüsse eingegangen.';
    albumError.hidden = false;
  }
  if (!albumWidmung.value.trim()) albumWidmung.value = WIDMUNG_VORLAGE;

  // Älteste Aufnahme ist erfahrungsgemäss der Testeintrag und
  // wird deshalb vorsorglich abgewählt.
  const sortiert = [...allRows].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  const testId = sortiert.length ? sortiert[0].id : null;

  albumListe.innerHTML = sortiert.map(r => `
    <label class="album-zeile">
      <input type="checkbox" value="${esc(r.id)}" ${r.id === testId ? '' : 'checked'}>
      ${r.thumb_url
        ? `<img src="${esc(r.thumb_url)}" alt="">`
        : '<span class="album-zeile__kein">–</span>'}
      <span class="album-zeile__text">
        <strong>${esc(r.name)}</strong>
        <span class="album-zeile__datum">${formatDate(r.created_at)}${
          r.id === testId ? ' · ältester Eintrag, vermutlich der Test' : ''}</span>
      </span>
    </label>`).join('');

  albumListe.querySelectorAll('input').forEach(c => c.addEventListener('change', aktualisiereAlbumZahl));
  aktualisiereAlbumZahl();
  albumModal.hidden = false;

  if (!albumLogo) albumLogo = await ladeAlbumLogo();
}

function gewaehlteGruesse() {
  const ids = [...albumListe.querySelectorAll('input:checked')].map(c => c.value);
  return ids
    .map(id => allRows.find(r => r.id === id))
    .filter(Boolean)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function aktualisiereAlbumZahl() {
  const n = gewaehlteGruesse().length;
  albumRun.textContent = n ? `Album öffnen (${n} Grüsse)` : 'Album öffnen';
  albumRun.disabled = n === 0;
}

/* Logo in Originalfarben – anders als auf den Etiketten */
async function ladeAlbumLogo() {
  try {
    const res = await fetch('../assets/logo.svg');
    if (!res.ok) throw new Error('nicht gefunden');
    const text = await res.text();
    const viewBox = (text.match(/viewBox="([^"]+)"/) || [])[1];
    if (!viewBox) throw new Error('kein viewBox');
    const inner = text
      .replace(/[\s\S]*?<svg[^>]*>/i, '')
      .replace(/<\/svg>[\s\S]*$/i, '');
    const [, , w, h] = viewBox.split(/[\s,]+/).map(Number);
    return { viewBox, inner, ratio: w / h };
  } catch (e) {
    console.warn('Logo nicht verfügbar:', e);
    return null;
  }
}

function erzeugeAlbum() {
  const gruesse = gewaehlteGruesse();
  if (gruesse.length === 0) {
    albumError.textContent = 'Bitte mindestens einen Gruss auswählen.';
    albumError.hidden = false;
    return;
  }
  // Als Blob-Dokument oeffnen, nicht per document.write: nur so laedt
  // ein neues Fenster zuverlaessig die Fotos aus dem Speicher nach.
  const html = albumHtml(gruesse, albumWidmung.value, albumLogo);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const fenster = window.open(url, '_blank');
  if (!fenster) {
    URL.revokeObjectURL(url);
    albumError.textContent = 'Das Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.';
    albumError.hidden = false;
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  albumModal.hidden = true;
}

/* --- Das Album-Dokument -------------------------------------------- */

function albumHtml(gruesse, widmung, logo) {
  const DATUM = '31. August 2026';

  const logoSvg = (breiteMm) => logo
    ? `<svg class="logo" viewBox="${logo.viewBox}" role="img" aria-label="Jäggi Vollmer"
            style="width:${breiteMm}mm;height:${(breiteMm / logo.ratio).toFixed(1)}mm;"><use href="#jv-logo"/></svg>`
    : '';

  const logoDefs = logo
    ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
         <symbol id="jv-logo" viewBox="${logo.viewBox}">${logo.inner}</symbol>
       </svg>`
    : '';

  const seiten = gruesse.map((r, i) => {
    const worte = [r.wort1, r.wort2].filter(Boolean);
    return `
    <section class="seite seite--gruss">
      <div class="foto">
        ${r.foto_url
          ? `<img src="${esc(r.foto_url)}" alt="Selfie von ${esc(r.name)}" data-album-foto>`
          : '<div class="foto__fehlt">Foto nicht verfügbar</div>'}
      </div>
      <div class="text">
        <p class="text__name">${esc(r.name)}</p>
        <div class="text__linie"></div>
        <p class="text__nachricht">${esc(r.nachricht)}</p>
        ${worte.length ? `<p class="text__worte">${worte.map(w => esc(w)).join('<span class="punkt">·</span>')}</p>` : ''}
      </div>
      <span class="seitenzahl">${i + 1}</span>
    </section>`;
  }).join('\n');

  const namen = [...new Set(gruesse.map(r => (r.name || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de'));

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Fotoalbum · Grüsse zur Geschäftsübergabe</title>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap"
      onload="this.onload=null;this.rel='stylesheet'">
<style>
  @page { size: 297mm 210mm; margin: 0; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #E7E2D6;
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    color: #2A3138;
  }

  /* Bedienleiste, wird nicht gedruckt */
  .leiste {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    padding: 14px 22px; background: #fff;
    border-bottom: 1px solid #DDD5C2;
    box-shadow: 0 2px 10px rgba(42,49,56,0.07);
  }
  .leiste__titel { font-weight: 700; font-size: 15px; }
  .leiste__info { color: #7A858D; font-size: 13px; }
  .leiste__btn {
    margin-left: auto; padding: 10px 20px;
    font-family: inherit; font-size: 14px; font-weight: 500; color: #2A3138;
    background: linear-gradient(135deg, #C9A877 0%, #BE853B 100%);
    border: none; border-radius: 8px; cursor: pointer;
  }
  .leiste__btn:disabled { opacity: 0.5; cursor: progress; }

  .buch { padding: 26px 20px 60px; display: flex; flex-direction: column; align-items: center; gap: 10mm; }

  .seite {
    width: 297mm; height: 210mm;
    background: #FDFAF3;
    position: relative;
    overflow: hidden;
    box-shadow: 0 6px 26px rgba(42,49,56,0.16);
  }

  /* --- Titelseite --- */
  .seite--titel {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 24mm;
  }
  .seite--titel::after {
    content: ''; position: absolute; inset: 10mm;
    border: 0.4mm solid #DCC9A4; pointer-events: none;
  }
  .titel__eyebrow {
    color: #BE853B; font-size: 11pt; font-weight: 500; letter-spacing: 6px; margin-bottom: 14mm;
  }
  .titel__haupt {
    font-family: 'Lora', Georgia, 'Times New Roman', serif;
    font-size: 40pt; line-height: 1.15; color: #2A3138; margin: 0;
  }
  .titel__linie { width: 22mm; height: 0.4mm; background: #BE853B; margin: 9mm 0; }
  .titel__unter {
    font-size: 13pt; color: #5A6670; line-height: 1.6; max-width: 150mm; margin: 0;
  }
  .titel__logo { margin-top: 18mm; }
  .titel__fuss {
    position: absolute; bottom: 16mm; left: 0; right: 0;
    font-size: 9pt; letter-spacing: 2px; color: #9AA1A6;
  }

  /* --- Widmung --- */
  .seite--widmung {
    display: flex; align-items: center; justify-content: center; padding: 30mm 40mm;
  }
  .widmung {
    font-family: 'Lora', Georgia, 'Times New Roman', serif;
    font-size: 14pt; line-height: 1.95; color: #3A444B;
    white-space: pre-line; max-width: 175mm; text-align: center;
  }

  /* --- Grussseite --- */
  .seite--gruss { display: flex; gap: 12mm; padding: 15mm; }

  .foto {
    width: 112mm; flex: none; height: 100%;
    background: #F1EADC;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  /* Jedes Foto fuellt seine Flaeche - nie ein Rahmen ringsum */
  .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .foto__fehlt { color: #A9B0B5; font-size: 10pt; }

  /* Querformat: eigenes Seitenlayout. Das Foto bekommt eine feste Hoehe,
     die Breite ergibt sich aus seinem eigenen Seitenverhaeltnis - dadurch
     wird weder beschnitten noch gerahmt. Darunter bleibt Platz fuer Text. */
  .seite--quer { flex-direction: column; align-items: center; padding: 14mm 24mm 12mm; gap: 9mm; }
  .seite--quer .foto {
    height: 112mm; width: auto; max-width: 100%; flex: none; background: none;
  }
  .seite--quer .foto img {
    /* Etwas nach oben versetzt, dort stehen bei Gruppenbildern die Gesichter */
    object-position: center 42%;
  }
  .seite--quer .text {
    /* min-height: 0 ist entscheidend - sonst waechst der Block mit dem
       Text ueber die Seite hinaus und laesst sich nicht mehr messen. */
    flex: 1; min-height: 0; width: 100%; height: auto;
    align-items: center; text-align: center;
    padding: 0 6mm;
  }
  /* Im schmaleren Band enger setzen als in der Hochformat-Spalte */
  .seite--quer .text__name { font-size: 18pt; }
  .seite--quer .text__linie { margin: 3.5mm auto 4.5mm; }
  .seite--quer .text__nachricht { max-width: 205mm; }
  .seite--quer .text__worte { margin-top: 5mm; }

  .text {
    flex: 1; min-width: 0; height: 100%;
    display: flex; flex-direction: column; justify-content: center;
    padding-right: 6mm;
  }
  .text__name {
    font-size: 20pt; font-weight: 700; color: #2A3138; margin: 0; letter-spacing: -0.3px;
  }
  .text__linie { width: 16mm; height: 0.4mm; background: #BE853B; margin: 6mm 0 7mm; }
  .text__nachricht {
    font-family: 'Lora', Georgia, 'Times New Roman', serif;
    font-size: 13pt; line-height: 1.75; color: #3A444B; margin: 0;
    white-space: pre-line; overflow-wrap: break-word;
  }
  .text__worte {
    margin: 9mm 0 0; font-size: 11pt; font-weight: 500; letter-spacing: 1.5px;
    text-transform: uppercase; color: #BE853B;
  }
  .text__worte .punkt { margin: 0 3mm; color: #DCC9A4; }

  .seitenzahl {
    position: absolute; right: 15mm; bottom: 11mm;
    font-size: 9pt; color: #B4BABE;
  }

  /* --- Namensverzeichnis --- */
  .seite--namen { padding: 24mm 26mm; display: flex; flex-direction: column; }
  .namen__titel {
    font-family: 'Lora', Georgia, serif; font-size: 24pt; color: #2A3138;
    margin: 0 0 3mm; text-align: center;
  }
  .namen__unter { text-align: center; color: #7A858D; font-size: 11pt; margin: 0 0 12mm; }
  .namen__liste {
    columns: 3; column-gap: 16mm; font-size: 11.5pt; line-height: 2.1; color: #3A444B;
    flex: 1;
  }
  .namen__liste span { display: block; break-inside: avoid; }
  .namen__schluss {
    margin-top: 8mm; text-align: center; color: #BE853B;
    font-family: 'Lora', Georgia, serif; font-size: 12pt; font-style: italic;
  }

  @media print {
    body { background: #fff; }
    .leiste { display: none; }
    .buch { padding: 0; gap: 0; display: block; }
    .seite {
      box-shadow: none;
      page-break-after: always;
      break-after: page;
    }
    .seite:last-child { page-break-after: auto; break-after: auto; }
  }
</style>
</head>
<body>

<div class="leiste">
  <span class="leiste__titel">Fotoalbum</span>
  <span class="leiste__info" id="fortschritt">Fotos werden geladen …</span>
  <button type="button" class="leiste__btn" id="druck" disabled onclick="window.print()">Als PDF drucken</button>
</div>

${logoDefs}

<div class="buch">

  <section class="seite seite--titel">
    <div class="titel__eyebrow">${DATUM.toUpperCase()}</div>
    <h1 class="titel__haupt">Für Felix<br>und Sonja</h1>
    <div class="titel__linie"></div>
    <p class="titel__unter">Grüsse, Gesichter und gute Wünsche<br>von eurem Abend der Geschäftsübergabe</p>
    <div class="titel__logo">${logoSvg(52)}</div>
    <div class="titel__fuss">JÄGGI VOLLMER GMBH · BASEL</div>
  </section>

  <section class="seite seite--widmung">
    <div class="widmung">${esc(widmung || '')}</div>
  </section>

${seiten}

  <section class="seite seite--namen">
    <h2 class="namen__titel">Mit Grüssen von</h2>
    <p class="namen__unter">${namen.length} ${namen.length === 1 ? 'Person' : 'Personen'}, die an diesem Abend dabei waren</p>
    <div class="namen__liste">${namen.map(n => `<span>${esc(n)}</span>`).join('')}</div>
    <p class="namen__schluss">Danke für diesen Abend.</p>
  </section>

</div>

<script>
  /* Hochformat-Fotos fuellen den Rahmen, Querformat bleibt unbeschnitten.
     Der Druck-Knopf oeffnet erst, wenn alle Fotos geladen sind. */
  (function () {
    var fotos = Array.prototype.slice.call(document.querySelectorAll('[data-album-foto]'));
    var fertig = 0;
    var anzeige = document.getElementById('fortschritt');
    var knopf = document.getElementById('druck');

    function melde() {
      fertig++;
      if (anzeige) anzeige.textContent = 'Fotos werden geladen … ' + fertig + ' / ' + fotos.length;
      if (fertig >= fotos.length) {
        if (anzeige) anzeige.textContent = fotos.length + ' Fotos geladen · A4 quer · ' +
          document.querySelectorAll('.seite').length + ' Seiten';
        if (knopf) knopf.disabled = false;
      }
    }

    function pruefeAusrichtung(bild) {
      if (!bild.naturalWidth || !bild.naturalHeight) return;
      var seite = bild.closest('.seite');
      if (!seite) return;
      var verhaeltnis = bild.naturalWidth / bild.naturalHeight;

      // Deutlich breiter als hoch: eigenes Layout mit Foto oben
      if (verhaeltnis > 1.15) {
        seite.classList.add('seite--quer');
        var rahmen = seite.querySelector('.foto');
        if (rahmen) {
          var text = seite.querySelector('.text__nachricht');
          var laenge = text ? text.textContent.trim().length : 0;
          // Je laenger der Gruss, desto kleiner das Foto - lieber ein
          // ruhiges Bild als ein winzig gesetzter Text.
          var hoehe = laenge > 900 ? 74 : laenge > 650 ? 86 : laenge > 400 ? 98 : 112;
          // Nie breiter als der Satzspiegel: sonst muesste beschnitten werden
          hoehe = Math.min(hoehe, 249 / verhaeltnis);
          rahmen.style.height = hoehe.toFixed(1) + 'mm';
          rahmen.style.width = (hoehe * verhaeltnis).toFixed(1) + 'mm';
        }
      }
      passeTextAn(seite);
    }

    /* Lange Nachrichten verkleinern, bis der Textblock in seinen Bereich
       passt. Gemessen wird der Abstand vom ersten zum letzten Element -
       bei zentriertem Inhalt taugt scrollHeight dafuer nicht. */
    function passeTextAn(seite) {
      var block = seite.querySelector('.text');
      var nachricht = seite.querySelector('.text__nachricht');
      if (!block || !nachricht || !block.children.length) return;

      // Immer von der Ausgangsgroesse aus rechnen, damit ein zweiter
      // Durchgang nach dem Laden der Schrift nicht doppelt verkleinert
      nachricht.style.fontSize = '';
      nachricht.style.lineHeight = '';

      var stil = window.getComputedStyle(block);
      var seitenStil = window.getComputedStyle(seite);
      var platz = block.clientHeight -
        parseFloat(stil.paddingTop) - parseFloat(stil.paddingBottom);
      // Zweite Schranke: der untere Seitenrand. Damit wird auch dann
      // richtig gemessen, wenn der Block selbst mitwaechst.
      var oben = block.getBoundingClientRect().top + parseFloat(stil.paddingTop);
      var boden = seite.getBoundingClientRect().bottom -
        parseFloat(seitenStil.paddingBottom);
      platz = Math.min(platz, boden - oben);
      var start = parseFloat(window.getComputedStyle(nachricht).fontSize);
      var minimum = start * 0.66;   // rund 8.5pt, darunter wird es unleserlich

      function inhaltsHoehe() {
        var k = block.children;
        return k[k.length - 1].getBoundingClientRect().bottom -
               k[0].getBoundingClientRect().top;
      }

      var groesse = start;
      var schutz = 20;
      while (inhaltsHoehe() > platz - 2 && groesse > minimum && schutz-- > 0) {
        groesse *= 0.96;
        nachricht.style.fontSize = groesse + 'px';
        nachricht.style.lineHeight = '1.62';
      }
    }

    function alleTexteAnpassen() {
      document.querySelectorAll('.seite--gruss').forEach(passeTextAn);
    }

    if (fotos.length === 0) {
      if (anzeige) anzeige.textContent = 'Bereit';
      if (knopf) knopf.disabled = false;
    }

    fotos.forEach(function (bild) {
      if (bild.complete) { pruefeAusrichtung(bild); melde(); return; }
      bild.addEventListener('load', function () { pruefeAusrichtung(bild); melde(); });
      bild.addEventListener('error', melde);
    });

    /* Die Serifenschrift laedt nach. Sie ist breiter als die
       Ersatzschrift, deshalb muss danach nochmals gemessen werden -
       sonst laufen lange Texte aus ihrem Bereich heraus. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(alleTexteAnpassen).catch(function () {});
    }
    window.addEventListener('load', alleTexteAnpassen);
    window.addEventListener('beforeprint', alleTexteAnpassen);
    setTimeout(alleTexteAnpassen, 1500);
    setTimeout(alleTexteAnpassen, 4000);
  })();
<\/script>

</body>
</html>`;
}
