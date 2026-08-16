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
