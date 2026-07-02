/* ===================================================================
   Admin Dashboard – Login, Daten laden, Filter, CSV-Export
   =================================================================== */

const STORAGE_KEY = 'jv_admin_token';

const loginScreen = document.getElementById('login');
const loginForm   = document.getElementById('login-form');
const passwordIn  = document.getElementById('password');
const loginErr    = document.getElementById('login-error');

const dashboard   = document.getElementById('dashboard');
const refreshBtn  = document.getElementById('refresh-btn');
const csvBtn      = document.getElementById('csv-btn');
const logoutBtn   = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');
const tbody       = document.getElementById('tbody');
const rowCount    = document.getElementById('row-count');

const statOffen    = document.getElementById('stat-offen');
const statJa       = document.getElementById('stat-ja');
const statNein     = document.getElementById('stat-nein');
const statPersonen = document.getElementById('stat-personen');

const modal        = document.getElementById('confirm-modal');
const confirmText  = document.getElementById('confirm-text');
const confirmBtn   = document.getElementById('confirm-delete-btn');

const addBtn       = document.getElementById('add-guest-btn');
const guestModal   = document.getElementById('guest-modal');
const guestForm    = document.getElementById('guest-form');
const guestTitle   = document.getElementById('guest-modal-title');
const gId          = document.getElementById('g-id');
const gEmail       = document.getElementById('g-email');
const gMax         = document.getElementById('g-max');
const guestSaveBtn = document.getElementById('guest-save-btn');
const guestFormErr = document.getElementById('guest-form-error');

const deleteAllBtn      = document.getElementById('delete-all-btn');
const deleteAllModal    = document.getElementById('delete-all-modal');
const deleteAllCount    = document.getElementById('delete-all-count');
const deleteAllConfirm  = document.getElementById('delete-all-confirm');
const deleteAllRunBtn   = document.getElementById('delete-all-run-btn');
const deleteAllError    = document.getElementById('delete-all-error');

const importBtn      = document.getElementById('import-btn');
const importModal    = document.getElementById('import-modal');
const importFile     = document.getElementById('import-file');
const importPreview  = document.getElementById('import-preview');
const importCount    = document.getElementById('import-count');
const previewTable   = document.getElementById('preview-table');
const importError    = document.getElementById('import-error');
const importResult   = document.getElementById('import-result');
const importRunBtn   = document.getElementById('import-run-btn');
const importWarnings = document.getElementById('import-warnings');

let parsedGuests = [];
let importIssues = { errors: [], warnings: [] };

let pendingDeleteId = null;

let allRows = [];
let activeFilter = 'alle';
let searchQuery = '';

/* --- Init ---------------------------------------------------------- */

const savedToken = sessionStorage.getItem(STORAGE_KEY);
if (savedToken) {
  enterDashboard();
}

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

refreshBtn.addEventListener('click', () => loadAndRender());
csvBtn.addEventListener('click', exportCsv);

document.querySelectorAll('.filter-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    activeFilter = b.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  render();
});

tbody.addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  const id = tr?.dataset.id;
  if (!id) return;
  if (e.target.closest('.js-delete')) openDeleteModal(id);
  else if (e.target.closest('.js-edit')) openGuestModal(id);
});

addBtn.addEventListener('click', () => openGuestModal(null));

guestModal.addEventListener('click', (e) => {
  if (e.target.dataset.close) closeGuestModal();
});

guestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideGuestError();
  const payload = {
    id:       gId.value || undefined,
    email:    gEmail.value.trim().toLowerCase(),
    max_begleitpersonen: parseInt(gMax.value, 10) || 0
  };
  if (!payload.email) {
    return showGuestError('Bitte eine E-Mail-Adresse angeben.');
  }
  guestSaveBtn.disabled = true;
  guestSaveBtn.textContent = 'Speichern…';
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    const res = await fetch('/.netlify/functions/admin-guest-write', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return showGuestError(out.error || `Fehler ${res.status}`);
    closeGuestModal();
    await loadAndRender();
  } catch {
    showGuestError('Verbindung fehlgeschlagen.');
  } finally {
    guestSaveBtn.disabled = false;
    guestSaveBtn.textContent = 'Speichern';
  }
});

modal.addEventListener('click', (e) => {
  if (e.target.dataset.close) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modal.hidden) closeModal();
  if (!guestModal.hidden) closeGuestModal();
  if (!importModal.hidden) closeImportModal();
  if (!deleteAllModal.hidden) closeDeleteAllModal();
});

/* --- Alle Gäste löschen ------------------------------------------ */

deleteAllBtn.addEventListener('click', () => openDeleteAllModal());
deleteAllModal.addEventListener('click', (e) => { if (e.target.dataset.close) closeDeleteAllModal(); });

deleteAllConfirm.addEventListener('input', () => {
  deleteAllRunBtn.disabled = deleteAllConfirm.value.trim().toUpperCase() !== 'LÖSCHEN';
});

deleteAllRunBtn.addEventListener('click', async () => {
  if (deleteAllConfirm.value.trim().toUpperCase() !== 'LÖSCHEN') return;
  deleteAllRunBtn.disabled = true;
  deleteAllRunBtn.textContent = 'Lösche…';
  hideDeleteAllError();
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    const res = await fetch('/.netlify/functions/admin-delete-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'LÖSCHEN' })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Fehler ${res.status}`);
    closeDeleteAllModal();
    await loadAndRender();
  } catch (err) {
    showDeleteAllError(err.message);
  } finally {
    deleteAllRunBtn.textContent = 'Endgültig löschen';
    deleteAllRunBtn.disabled = deleteAllConfirm.value.trim().toUpperCase() !== 'LÖSCHEN';
  }
});

function openDeleteAllModal() {
  deleteAllConfirm.value = '';
  deleteAllRunBtn.disabled = true;
  hideDeleteAllError();
  deleteAllCount.textContent = allRows.length > 0 ? `alle ${allRows.length}` : 'alle';
  deleteAllModal.hidden = false;
  setTimeout(() => deleteAllConfirm.focus(), 50);
}
function closeDeleteAllModal() {
  deleteAllModal.hidden = true;
  deleteAllConfirm.value = '';
}
function showDeleteAllError(msg) { deleteAllError.textContent = msg; deleteAllError.hidden = false; }
function hideDeleteAllError()    { deleteAllError.hidden = true; deleteAllError.textContent = ''; }

/* --- CSV-Import --------------------------------------------------- */

importBtn.addEventListener('click', () => openImportModal());
importModal.addEventListener('click', (e) => { if (e.target.dataset.close) closeImportModal(); });

importFile.addEventListener('change', async () => {
  hideImportError();
  importResult.hidden = true;
  importPreview.hidden = true;
  importWarnings.hidden = true;
  importRunBtn.disabled = true;
  const file = importFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    parsedGuests = parseCsv(text);
    if (parsedGuests.length === 0) throw new Error('Keine Datenzeilen gefunden.');
    importIssues = analyzeGuests(parsedGuests);
    renderWarnings(importIssues);
    renderPreview(parsedGuests, importIssues);
    importPreview.hidden = false;
    // Import bleibt möglich, auch bei Warnungen. Nur wenn ALLE Zeilen harte
    // Fehler haben, wird der Button gesperrt.
    const importable = parsedGuests.length - importIssues.errors.length;
    importRunBtn.disabled = importable <= 0;
  } catch (err) {
    parsedGuests = [];
    showImportError(err.message);
  }
});

/* --- E-Mail-Plausibilitätsprüfung --------------------------------- */

const EMAIL_STRICT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Häufige Tippfehler bei Domains (Schweiz + international)
const DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com', 'gmailcom': 'gmail.com', 'googlemail.co': 'googlemail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com', 'hotmall.com': 'hotmail.com', 'hotmaill.com': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'bluewin.c': 'bluewin.ch', 'bluewin.com': 'bluewin.ch', 'blueiwn.ch': 'bluewin.ch',
  'gmx.c': 'gmx.ch', 'gmx.co': 'gmx.ch', 'gmx.con': 'gmx.net',
  'sunrise.c': 'sunrise.ch', 'swissonline.c': 'swissonline.ch',
  'hispeed.c': 'hispeed.ch', 'icloud.co': 'icloud.com', 'iclould.com': 'icloud.com'
};

// Gängige TLDs – alles andere wird als "ungewöhnlich" markiert (nur Warnung)
const KNOWN_TLDS = new Set([
  'ch','com','net','org','de','at','li','fr','it','eu','info','biz',
  'io','me','email','name','online','shop','swiss','edu','gov'
]);

function analyzeGuests(rows) {
  const errors = [];   // Zeilen, die NICHT importiert werden können
  const warnings = []; // Zeilen, die auffällig sind, aber importierbar
  const seen = new Map();

  rows.forEach((r) => {
    const email = r.email;
    const label = r.raw || '(leer)';

    if (!email) {
      errors.push({ zeile: r.zeile, email: label, grund: 'E-Mail fehlt.' });
      r._error = true;
      return;
    }

    // Harte Formatfehler
    if ((email.match(/@/g) || []).length !== 1) {
      errors.push({ zeile: r.zeile, email, grund: 'Ungültig: E-Mail muss genau ein @ enthalten.' });
      r._error = true;
      return;
    }
    if (!EMAIL_STRICT.test(email)) {
      errors.push({ zeile: r.zeile, email, grund: 'Ungültiges Format (fehlender Punkt/Domain oder ungültige Zeichen).' });
      r._error = true;
      return;
    }
    if (/\.\./.test(email) || /^\./.test(email.split('@')[0]) || /\.$/.test(email.split('@')[0])) {
      errors.push({ zeile: r.zeile, email, grund: 'Ungültig: doppelter oder falsch platzierter Punkt.' });
      r._error = true;
      return;
    }

    const domain = email.split('@')[1];
    const tld = domain.split('.').pop();

    // --- ab hier nur Warnungen (Import bleibt möglich) ---

    // Duplikat innerhalb der CSV
    if (seen.has(email)) {
      warnings.push({ zeile: r.zeile, email, grund: `Doppelt in der Datei (auch Zeile ${seen.get(email)}). Es wird nur ein Eintrag angelegt.` });
      r._warn = true;
    } else {
      seen.set(email, r.zeile);
    }

    // Domain-Tippfehler
    if (DOMAIN_TYPOS[domain]) {
      warnings.push({ zeile: r.zeile, email, grund: `Möglicher Tippfehler in der Domain – meintest du "${DOMAIN_TYPOS[domain]}"?` });
      r._warn = true;
    } else if (!KNOWN_TLDS.has(tld)) {
      warnings.push({ zeile: r.zeile, email, grund: `Ungewöhnliche Endung ".${tld}" – bitte prüfen.` });
      r._warn = true;
    }

    // Umlaute / Sonderzeichen (in CH-Mailadressen sehr selten)
    if (/[äöüàéèç]/i.test(email)) {
      warnings.push({ zeile: r.zeile, email, grund: 'Enthält Umlaut/Akzent – bitte prüfen.' });
      r._warn = true;
    }
  });

  return { errors, warnings };
}

function renderWarnings({ errors, warnings }) {
  if (errors.length === 0 && warnings.length === 0) {
    importWarnings.hidden = true;
    importWarnings.innerHTML = '';
    return;
  }
  let html = '';
  if (errors.length > 0) {
    html += `<div class="import-warnings__head import-warnings__head--error">
      ⚠ ${errors.length} ${errors.length === 1 ? 'Zeile wird' : 'Zeilen werden'} übersprungen (ungültige E-Mail)</div>`;
    html += '<ul class="import-warnings__list">' + errors.map(e =>
      `<li><span class="iw-zeile">Zeile ${e.zeile}</span> <code>${esc(e.email)}</code> – ${esc(e.grund)}</li>`
    ).join('') + '</ul>';
  }
  if (warnings.length > 0) {
    html += `<div class="import-warnings__head import-warnings__head--warn">
      ⚠ ${warnings.length} ${warnings.length === 1 ? 'Auffälligkeit' : 'Auffälligkeiten'} – bitte prüfen (Import trotzdem möglich)</div>`;
    html += '<ul class="import-warnings__list">' + warnings.map(w =>
      `<li><span class="iw-zeile">Zeile ${w.zeile}</span> <code>${esc(w.email)}</code> – ${esc(w.grund)}</li>`
    ).join('') + '</ul>';
  }
  importWarnings.innerHTML = html;
  importWarnings.hidden = false;
}

importRunBtn.addEventListener('click', async () => {
  if (parsedGuests.length === 0) return;
  // Nur gültige Zeilen senden (Fehler-Zeilen wurden im Dialog angezeigt)
  const validGuests = parsedGuests
    .filter(g => !g._error)
    .map(g => ({ email: g.email, max_begleitpersonen: g.max_begleitpersonen }));
  if (validGuests.length === 0) {
    return showImportError('Keine gültigen E-Mail-Adressen zum Importieren.');
  }
  importRunBtn.disabled = true;
  importRunBtn.textContent = 'Importiere…';
  hideImportError();
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    const res = await fetch('/.netlify/functions/admin-guests-import', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ guests: validGuests })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Fehler ${res.status}`);
    showImportResult(out);
    await loadAndRender();
  } catch (err) {
    showImportError(err.message);
  } finally {
    importRunBtn.disabled = false;
    importRunBtn.textContent = 'Importieren';
  }
});

function openImportModal() {
  importFile.value = '';
  importPreview.hidden = true;
  importResult.hidden = true;
  importWarnings.hidden = true;
  importWarnings.innerHTML = '';
  importRunBtn.disabled = true;
  importRunBtn.textContent = 'Importieren';
  hideImportError();
  parsedGuests = [];
  importIssues = { errors: [], warnings: [] };
  importModal.hidden = false;
}

function closeImportModal() {
  importModal.hidden = true;
  parsedGuests = [];
  importIssues = { errors: [], warnings: [] };
}

function showImportError(msg) { importError.textContent = msg; importError.hidden = false; }
function hideImportError()    { importError.hidden = true; importError.textContent = ''; }

function renderPreview(rows, issues) {
  const skip = issues?.errors.length || 0;
  const ok = rows.length - skip;
  importCount.textContent = skip > 0
    ? `${rows.length} Zeilen erkannt · ${ok} werden importiert, ${skip} übersprungen`
    : `${rows.length} ${rows.length === 1 ? 'Zeile' : 'Zeilen'} erkannt`;
  const head = `<thead><tr><th></th><th>E-Mail</th><th class="num">Max BP</th></tr></thead>`;
  const body = '<tbody>' + rows.map(r => {
    const cls = r._error ? ' class="row-error"' : (r._warn ? ' class="row-warn"' : '');
    const icon = r._error ? '✗' : (r._warn ? '⚠' : '');
    return `
    <tr${cls}>
      <td class="preview-icon">${icon}</td>
      <td>${esc(r.email || r.raw)}</td>
      <td class="num">${r.max_begleitpersonen}</td>
    </tr>`;
  }).join('') + '</tbody>';
  previewTable.innerHTML = head + body;
}

function showImportResult({ counts, errors }) {
  const parts = [];
  if (counts.created > 0)  parts.push(`<div class="import-result__row"><span class="import-result__ok">✓ ${counts.created} neue Gäste hinzugefügt</span></div>`);
  if (counts.updated > 0)  parts.push(`<div class="import-result__row"><span class="import-result__update">↻ ${counts.updated} bestehende Gäste aktualisiert</span></div>`);
  if (counts.errors > 0)   parts.push(`<div class="import-result__row"><span class="import-result__error">✗ ${counts.errors} Zeilen fehlerhaft</span></div>`);
  if (parts.length === 0) parts.push('<div>Nichts wurde geändert.</div>');

  let details = '';
  if (errors?.length) {
    details = '<div class="import-result__details">' + errors.map(e =>
      `Zeile ${e.zeile}${e.name ? ` (${esc(e.name)})` : ''}: ${esc(e.grund)}`
    ).join('<br>') + '</div>';
  }
  importResult.innerHTML = parts.join('') + details;
  importResult.hidden = false;
  importPreview.hidden = true;
  importRunBtn.disabled = true;
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV enthält keine Datenzeilen.');

  const firstLine = lines[0];
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  const delim = semi >= comma ? ';' : ',';

  const parseRow = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === delim && !inQ) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(v => v.trim());
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ' ').trim());
  const findCol = (variants) => {
    for (const v of variants) {
      const i = headers.indexOf(v);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iMail = findCol(['e-mail', 'email', 'mail', 'e-mail-adresse']);
  const iMax  = findCol(['max begleitpersonen', 'begleitpersonen', 'max bp', 'max', 'begleitung']);

  if (iMail < 0) {
    throw new Error('Spalte E-Mail ist Pflicht. Bitte die Vorlage nutzen.');
  }

  return lines.slice(1).map(parseRow).map((row, idx) => {
    let max = iMax >= 0 ? parseInt(row[iMax], 10) : 0;
    if (isNaN(max) || max < 0) max = 0;
    if (max > 10) max = 10;
    return {
      email:    normalizeEmail(row[iMail] || ''),
      raw:      (row[iMail] || '').trim(),
      zeile:    idx + 2, // +1 für Header, +1 für 1-basiert
      max_begleitpersonen: max
    };
  }).filter(r => r.email || r.raw);
}

// E-Mail vereinheitlichen: trim, alle Leerzeichen (auch innen) raus, lowercase
function normalizeEmail(v) {
  return String(v).replace(/\s+/g, '').toLowerCase();
}

confirmBtn.addEventListener('click', async () => {
  if (!pendingDeleteId) return closeModal();
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Lösche…';
  try {
    await deleteRow(pendingDeleteId);
    closeModal();
    await loadAndRender();
  } catch (err) {
    alert(err.message || 'Löschen fehlgeschlagen.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Ja, löschen';
  }
});

function openDeleteModal(id) {
  const row = allRows.find(r => r.id === id);
  pendingDeleteId = id;
  if (row) {
    confirmText.innerHTML = `Möchten Sie den Eintrag von <strong>${esc(row.vorname)} ${esc(row.nachname)}</strong> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
  } else {
    confirmText.textContent = 'Möchten Sie diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.';
  }
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
  pendingDeleteId = null;
}

function openGuestModal(id) {
  hideGuestError();
  if (id) {
    const row = allRows.find(r => r.id === id);
    if (!row) return;
    guestTitle.textContent = 'Gast bearbeiten';
    gId.value       = row.id;
    gEmail.value    = row.email || '';
    gMax.value      = String(row.max_begleitpersonen ?? 0);
  } else {
    guestTitle.textContent = 'Gast hinzufügen';
    guestForm.reset();
    gId.value = '';
    gMax.value = '0';
  }
  guestModal.hidden = false;
  setTimeout(() => gEmail.focus(), 50);
}

function closeGuestModal() {
  guestModal.hidden = true;
  guestForm.reset();
}

function showGuestError(msg) { guestFormErr.textContent = msg; guestFormErr.hidden = false; }
function hideGuestError()    { guestFormErr.hidden = true; guestFormErr.textContent = ''; }

async function deleteRow(id) {
  const token = sessionStorage.getItem(STORAGE_KEY);
  const res = await fetch('/.netlify/functions/admin-delete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id })
  });
  if (!res.ok) {
    const out = await res.json().catch(() => ({}));
    throw new Error(out.error || `Fehler ${res.status}`);
  }
}

/* --- Data ---------------------------------------------------------- */

async function fetchData(token) {
  const res = await fetch('/.netlify/functions/admin-list', {
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
  if (preloaded) {
    applyData(preloaded);
  } else {
    await loadAndRender();
  }
}

function applyData({ rows, stats }) {
  allRows = rows || [];
  statOffen.textContent    = stats?.offen          ?? 0;
  statJa.textContent       = stats?.angemeldet     ?? 0;
  statNein.textContent     = stats?.abgemeldet     ?? 0;
  statPersonen.textContent = stats?.personen_total ?? 0;
  render();
}

/* --- Render -------------------------------------------------------- */

function render() {
  let filtered = allRows;

  if (activeFilter !== 'alle') {
    filtered = filtered.filter(r => r.status === activeFilter);
  }
  if (searchQuery) {
    filtered = filtered.filter(r =>
      (`${r.vorname} ${r.nachname}`).toLowerCase().includes(searchQuery) ||
      (r.email || '').toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Keine Einträge.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(rowHtml).join('');
  }
  rowCount.textContent = `${filtered.length} von ${allRows.length} Einträgen`;
}

function rowHtml(r) {
  const isJa    = r.status === 'angemeldet';
  const isNein  = r.status === 'abgemeldet';
  const isOffen = r.status === 'offen';
  let badge;
  if (isJa)    badge = `<span class="status-badge status-badge--ok"><span class="status-badge__dot"></span>Zugesagt</span>`;
  else if (isNein)  badge = `<span class="status-badge status-badge--no"><span class="status-badge__dot"></span>Abgesagt</span>`;
  else         badge = `<span class="status-badge status-badge--neutral"><span class="status-badge__dot"></span>Offen</span>`;

  const personen = isJa ? 1 + (r.anzahl_begleitpersonen || 0) : 0;
  const bpList = Array.isArray(r.begleitpersonen) ? r.begleitpersonen : [];
  const bpNames = isJa && bpList.length
    ? `<div class="row-subline">+ ${bpList.map(p => esc(`${p.vorname || ''} ${p.nachname || ''}`.trim())).join(', ')}</div>`
    : '';
  const nameCell = (r.vorname || r.nachname)
    ? `<strong>${esc(r.vorname)}</strong> ${esc(r.nachname)}`
    : `<em class="row-placeholder">– noch nicht angegeben –</em>`;
  return `
    <tr data-id="${esc(r.id)}">
      <td>${badge}</td>
      <td>${nameCell}${bpNames}</td>
      <td>${esc(r.email)}</td>
      <td class="num">${r.max_begleitpersonen ?? 0}</td>
      <td class="num">${isJa ? personen : '–'}</td>
      <td>${isOffen ? '–' : formatDate(r.updated_at || r.created_at)}</td>
      <td class="row-actions">
        <button type="button" class="action-btn js-edit" title="Gast bearbeiten" aria-label="Gast bearbeiten">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button type="button" class="action-btn action-btn--danger js-delete" title="Eintrag löschen" aria-label="Eintrag löschen">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    </tr>
  `;
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* --- CSV Export --------------------------------------------------- */

function exportCsv() {
  const cols = ['Status', 'Vorname', 'Nachname', 'E-Mail', 'Max Begleitpersonen', 'Begleitpersonen', 'Namen Begleitpersonen', 'Personen total', 'Antwort am', 'Bestaetigung gesendet'];
  const lines = [cols.join(';')];

  allRows.forEach(r => {
    const isJa    = r.status === 'angemeldet';
    const isNein  = r.status === 'abgemeldet';
    const label   = isJa ? 'Zugesagt' : (isNein ? 'Abgesagt' : 'Offen');
    const bpList  = Array.isArray(r.begleitpersonen) ? r.begleitpersonen : [];
    const bpNames = isJa && bpList.length
      ? bpList.map(p => `${p.vorname || ''} ${p.nachname || ''}`.trim()).join(', ')
      : '';
    lines.push([
      label,
      csvCell(r.vorname),
      csvCell(r.nachname),
      csvCell(r.email),
      r.max_begleitpersonen ?? 0,
      isJa ? (r.anzahl_begleitpersonen || 0) : '',
      csvCell(bpNames),
      isJa ? 1 + (r.anzahl_begleitpersonen || 0) : '',
      isJa || isNein ? new Date(r.updated_at).toLocaleString('de-CH') : '',
      r.bestaetigung_gesendet ? 'ja' : 'nein'
    ].join(';'));
  });

  const csv = '﻿' + lines.join('\n'); // BOM für Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `anmeldungen_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(s) {
  const v = String(s || '');
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
