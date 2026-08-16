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

refreshBtn.addEventListener('click', () => loadAndRender());
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
  const foto = r.foto_url
    ? `<div class="gruss-card__foto"><img src="${esc(r.foto_url)}" alt="Selfie von ${esc(r.name)}" loading="lazy"></div>`
    : `<div class="gruss-card__foto gruss-card__foto--missing">Foto fehlt</div>`;
  const words = [r.wort1, r.wort2].filter(Boolean)
    .map(w => `<span class="word-chip">${esc(w)}</span>`).join('');
  const dl = r.foto_url
    ? `<a class="gruss-card__dl" href="${esc(r.foto_url)}" download target="_blank" rel="noopener">Foto herunterladen</a>`
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
