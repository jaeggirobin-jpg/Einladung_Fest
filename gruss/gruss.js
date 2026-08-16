/* ===================================================================
   Gästebuch: Freischalt-Status, Selfie in Druckqualität,
   Direkt-Upload zu Supabase Storage
   =================================================================== */

/* Bildgrössen:
   – Original: bis 3000px lange Kante, JPEG 0.92
     => bei 300 dpi rund 25 cm Druckbreite, also mehr als genug fürs Album
   – Vorschau: 640px, JPEG 0.75 für die Galerie (spart Datenvolumen) */
const ORIGINAL_MAX_PX = 3000;
const ORIGINAL_QUALITY = 0.92;
const THUMB_MAX_PX = 640;
const THUMB_QUALITY = 0.75;

const loadingPanel = document.getElementById('loading-panel');
const welcomePanel = document.getElementById('welcome-panel');
const formWrap     = document.getElementById('form-wrap');
const countdownEl  = document.getElementById('countdown-line');

const form         = document.getElementById('gruss-form');
const fotoInput    = document.getElementById('foto-input');
const fotoBtn      = document.getElementById('foto-btn');
const previewWrap  = document.getElementById('foto-preview-wrap');
const previewImg   = document.getElementById('foto-preview');
const retakeBtn    = document.getElementById('foto-retake');
const nameInput    = document.getElementById('name');
const msgInput     = document.getElementById('nachricht');
const wort1Input   = document.getElementById('wort1');
const wort2Input   = document.getElementById('wort2');
const charCount    = document.getElementById('char-count');
const errorBox     = document.getElementById('form-error');
const submitBtn    = document.getElementById('submit-btn');
const uploadStatus = document.getElementById('upload-status');
const successPanel = document.getElementById('success-panel');
const againBtn     = document.getElementById('again-btn');
const heroText     = formWrap.querySelector('.hero-text');

let originalBlob = null;
let thumbBlob    = null;
let freigabeAb   = null;
let istOffen     = false;
let pollTimer    = null;
let countdownTimer = null;

/* --- Freischalt-Status --------------------------------------------- */

init();

async function init() {
  await pruefeStatus();
  // Solange gesperrt: alle 20 Sekunden nachschauen, damit sich die
  // Seite von selbst öffnet, ohne dass jemand neu laden muss.
  pollTimer = setInterval(() => { if (!istOffen) pruefeStatus(); }, 20000);
}

async function pruefeStatus() {
  try {
    const res = await fetch('/.netlify/functions/gruss-status', { cache: 'no-store' });
    const out = await res.json();
    setzeStatus(out.offen === true, out.freigabe_ab || null);
  } catch {
    // Netzwerkfehler: Willkommens-Screen zeigen, weiter pollen
    setzeStatus(false, freigabeAb);
  }
}

function setzeStatus(offen, ab) {
  istOffen = offen;
  freigabeAb = ab;
  loadingPanel.hidden = true;

  if (offen) {
    welcomePanel.hidden = true;
    formWrap.hidden = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  } else {
    formWrap.hidden = true;
    welcomePanel.hidden = false;
    zeigeCountdown();
  }
}

function zeigeCountdown() {
  if (!freigabeAb) {
    countdownEl.hidden = true;
    return;
  }
  const ziel = new Date(freigabeAb);
  const update = () => {
    const diff = ziel.getTime() - Date.now();
    if (diff <= 0) {
      countdownEl.textContent = 'Es geht gleich los …';
      pruefeStatus();
      return;
    }
    const zeit = ziel.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    const min = Math.ceil(diff / 60000);
    countdownEl.textContent = min > 90
      ? `Freigeschaltet ab ${zeit} Uhr`
      : `Freigeschaltet ab ${zeit} Uhr – noch ${min} Min.`;
    countdownEl.hidden = false;
  };
  update();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(update, 30000);
}

/* --- Selfie ------------------------------------------------------- */

fotoBtn.addEventListener('click', () => fotoInput.click());
retakeBtn.addEventListener('click', () => fotoInput.click());

fotoInput.addEventListener('change', async () => {
  const file = fotoInput.files[0];
  if (!file) return;
  hideError();
  setStatus('Foto wird vorbereitet …');
  try {
    const img = await ladeBild(file);
    originalBlob = await skaliere(img, ORIGINAL_MAX_PX, ORIGINAL_QUALITY);
    thumbBlob    = await skaliere(img, THUMB_MAX_PX, THUMB_QUALITY);
    previewImg.src = URL.createObjectURL(thumbBlob);
    previewWrap.hidden = false;
    fotoBtn.hidden = true;
  } catch (e) {
    console.error(e);
    originalBlob = thumbBlob = null;
    showError('Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.');
  } finally {
    setStatus('');
  }
});

async function ladeBild(file) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
}

async function skaliere(img, maxPx, quality) {
  let { width, height } = img;
  // Nur verkleinern, nie hochrechnen
  if (width > maxPx || height > maxPx) {
    const scale = maxPx / Math.max(width, height);
    width  = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('toBlob failed');
  return blob;
}

/* --- Zeichenzähler ------------------------------------------------- */

msgInput.addEventListener('input', () => {
  charCount.textContent = msgInput.value.length;
});

/* --- Submit -------------------------------------------------------- */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const name      = nameInput.value.trim();
  const nachricht = msgInput.value.trim();

  if (!originalBlob) return showError('Bitte zuerst ein Selfie machen (Schritt 1).');
  if (!name)         return showError('Bitte deinen Namen angeben (Schritt 2).');
  if (!nachricht)    return showError('Bitte eine Nachricht schreiben (Schritt 3).');

  setSubmitting(true);

  try {
    // 1. Signierte Upload-URLs holen
    setStatus('Foto wird hochgeladen …');
    const urlRes = await fetch('/.netlify/functions/gruss-upload-url', { method: 'POST' });
    const urlOut = await urlRes.json().catch(() => ({}));
    if (!urlRes.ok) throw new Error(urlOut.error || 'Upload konnte nicht vorbereitet werden.');

    // 2. Original + Vorschau direkt zu Supabase Storage
    const [origRes, thumbRes] = await Promise.all([
      fetch(urlOut.original.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: originalBlob
      }),
      fetch(urlOut.thumb.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: thumbBlob
      })
    ]);
    if (!origRes.ok) throw new Error('Foto-Upload fehlgeschlagen. Bitte erneut versuchen.');

    // 3. Gruss speichern
    setStatus('Gruss wird gespeichert …');
    const subRes = await fetch('/.netlify/functions/gruss-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        nachricht,
        wort1: wort1Input.value.trim(),
        wort2: wort2Input.value.trim(),
        foto_path: urlOut.original.path,
        thumb_path: thumbRes.ok ? urlOut.thumb.path : '',
        website: form.website.value
      })
    });
    const subOut = await subRes.json().catch(() => ({}));
    if (!subRes.ok) throw new Error(subOut.error || 'Speichern fehlgeschlagen.');

    form.hidden = true;
    heroText.hidden = true;
    successPanel.hidden = false;
    successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    showError(err.message || 'Es ist ein Fehler aufgetreten. Bitte erneut versuchen.');
  } finally {
    setSubmitting(false);
    setStatus('');
  }
});

/* --- Nochmal ------------------------------------------------------- */

againBtn.addEventListener('click', () => {
  form.reset();
  originalBlob = thumbBlob = null;
  fotoInput.value = '';
  previewWrap.hidden = true;
  fotoBtn.hidden = false;
  charCount.textContent = '0';
  successPanel.hidden = true;
  heroText.hidden = false;
  form.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* --- Helpers ------------------------------------------------------- */

function setSubmitting(on) {
  form.classList.toggle('is-submitting', on);
  submitBtn.disabled = on;
}

function setStatus(msg) {
  uploadStatus.textContent = msg;
  uploadStatus.hidden = !msg;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}
