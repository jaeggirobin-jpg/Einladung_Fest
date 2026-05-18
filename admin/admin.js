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
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Keine Einträge.</td></tr>`;
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
    <tr>
      <td>${badge}</td>
      <td><strong>${esc(r.vorname)}</strong> ${esc(r.nachname)}</td>
      <td>${esc(r.email)}</td>
      <td class="num">${isJa ? personen : '–'}</td>
      <td>${formatDate(r.updated_at || r.created_at)}</td>
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
