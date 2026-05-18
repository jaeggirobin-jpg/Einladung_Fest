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

const statJa       = document.getElementById('stat-ja');
const statNein     = document.getElementById('stat-nein');
const statPersonen = document.getElementById('stat-personen');

const modal        = document.getElementById('confirm-modal');
const confirmText  = document.getElementById('confirm-text');
const confirmBtn   = document.getElementById('confirm-delete-btn');

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
  const btn = e.target.closest('.js-delete');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = tr?.dataset.id;
  if (!id) return;
  openDeleteModal(id);
});

modal.addEventListener('click', (e) => {
  if (e.target.dataset.close) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

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
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Keine Einträge.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(rowHtml).join('');
  }
  rowCount.textContent = `${filtered.length} von ${allRows.length} Einträgen`;
}

function rowHtml(r) {
  const isJa = r.status === 'angemeldet';
  const badge = isJa
    ? `<span class="status-badge status-badge--ok"><span class="status-badge__dot"></span>Zugesagt</span>`
    : `<span class="status-badge status-badge--no"><span class="status-badge__dot"></span>Abgesagt</span>`;
  const personen = isJa ? 1 + (r.anzahl_begleitpersonen || 0) : 0;
  return `
    <tr data-id="${esc(r.id)}">
      <td>${badge}</td>
      <td><strong>${esc(r.vorname)}</strong> ${esc(r.nachname)}</td>
      <td>${esc(r.email)}</td>
      <td class="num">${isJa ? personen : '–'}</td>
      <td>${formatDate(r.updated_at || r.created_at)}</td>
      <td>
        <button type="button" class="delete-btn js-delete" title="Eintrag löschen" aria-label="Eintrag löschen">
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
  const cols = ['Status', 'Vorname', 'Nachname', 'E-Mail', 'Begleitpersonen', 'Personen total', 'Antwort am', 'Bestaetigung gesendet'];
  const lines = [cols.join(';')];

  allRows.forEach(r => {
    const isJa = r.status === 'angemeldet';
    lines.push([
      isJa ? 'Zugesagt' : 'Abgesagt',
      csvCell(r.vorname),
      csvCell(r.nachname),
      csvCell(r.email),
      isJa ? (r.anzahl_begleitpersonen || 0) : '',
      isJa ? 1 + (r.anzahl_begleitpersonen || 0) : '',
      r.updated_at ? new Date(r.updated_at).toLocaleString('de-CH') : '',
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
