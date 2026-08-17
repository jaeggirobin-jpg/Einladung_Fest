/* ===================================================================
   Willkommensseite + Selfie-Station
   Die Station wird bewusst erst NACH der Freischaltung nachgeladen,
   damit im Seitenquelltext nichts über die Überraschung steht.
   =================================================================== */

/* Bildgrössen:
   – Original: bis 3000px lange Kante, JPEG 0.92
     => rund 25 cm Druckbreite bei 300 dpi, genug fürs Fotoalbum
   – Vorschau: 640px, JPEG 0.75 für die Galerie (spart Datenvolumen) */
const ORIGINAL_MAX_PX  = 3000;
const ORIGINAL_QUALITY = 0.92;
const THUMB_MAX_PX     = 640;
const THUMB_QUALITY    = 0.75;

const loadingPanel = document.getElementById('loading-panel');
const welcomePanel = document.getElementById('welcome-panel');
const formWrap     = document.getElementById('form-wrap');

let freigabeAb     = null;
let istOffen       = false;
let pollTimer      = null;
let stationGeladen = false;

// Elemente der Station (erst nach dem Nachladen verfügbar)
let el = {};
let originalBlob = null;
let thumbBlob    = null;

/* --- Start & Freischalt-Status ------------------------------------- */

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
    await setzeStatus(out.offen === true, out.freigabe_ab || null);
  } catch {
    // Netzwerkfehler: Willkommensseite zeigen, weiter pollen
    await setzeStatus(false, freigabeAb);
  }
}

async function setzeStatus(offen, ab) {
  istOffen = offen;
  freigabeAb = ab;

  if (offen) {
    const ok = await ladeStation();
    if (!ok) {
      // Nachladen fehlgeschlagen: Willkommensseite stehen lassen
      loadingPanel.hidden = true;
      welcomePanel.hidden = false;
      return;
    }
    loadingPanel.hidden = true;
    welcomePanel.hidden = true;
    formWrap.hidden = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  } else {
    // Nur die neutrale Programm-Seite. Kein Hinweis darauf,
    // dass später noch etwas kommt.
    loadingPanel.hidden = true;
    formWrap.hidden = true;
    welcomePanel.hidden = false;
  }
}

/* --- Station nachladen --------------------------------------------- */

async function ladeStation() {
  if (stationGeladen) return true;
  try {
    const res = await fetch('station.html', { cache: 'no-store' });
    if (!res.ok) throw new Error('Station nicht erreichbar');
    formWrap.innerHTML = await res.text();
    verbindeStation();
    stationGeladen = true;
    return true;
  } catch (e) {
    console.error('Station konnte nicht geladen werden:', e);
    return false;
  }
}

function verbindeStation() {
  el = {
    hero:        document.getElementById('station-hero'),
    form:        document.getElementById('gruss-form'),
    fotoInput:   document.getElementById('foto-input'),
    fotoBtn:     document.getElementById('foto-btn'),
    previewWrap: document.getElementById('foto-preview-wrap'),
    previewImg:  document.getElementById('foto-preview'),
    retakeBtn:   document.getElementById('foto-retake'),
    name:        document.getElementById('name'),
    msg:         document.getElementById('nachricht'),
    wort1:       document.getElementById('wort1'),
    wort2:       document.getElementById('wort2'),
    charCount:   document.getElementById('char-count'),
    errorBox:    document.getElementById('form-error'),
    submitBtn:   document.getElementById('submit-btn'),
    status:      document.getElementById('upload-status'),
    success:     document.getElementById('success-panel'),
    againBtn:    document.getElementById('again-btn')
  };

  el.fotoBtn.addEventListener('click', () => el.fotoInput.click());
  el.retakeBtn.addEventListener('click', () => el.fotoInput.click());
  el.fotoInput.addEventListener('change', verarbeiteFoto);
  el.msg.addEventListener('input', () => { el.charCount.textContent = el.msg.value.length; });
  el.form.addEventListener('submit', sendeGruss);
  el.againBtn.addEventListener('click', setzeZurueck);
}

/* --- Selfie -------------------------------------------------------- */

async function verarbeiteFoto() {
  const file = el.fotoInput.files[0];
  if (!file) return;
  hideError();
  setStatus('Foto wird vorbereitet …');
  try {
    const img = await ladeBild(file);
    originalBlob = await skaliere(img, ORIGINAL_MAX_PX, ORIGINAL_QUALITY);
    thumbBlob    = await skaliere(img, THUMB_MAX_PX, THUMB_QUALITY);
    el.previewImg.src = URL.createObjectURL(thumbBlob);
    el.previewWrap.hidden = false;
    el.fotoBtn.hidden = true;
  } catch (e) {
    console.error(e);
    originalBlob = thumbBlob = null;
    showError('Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.');
  } finally {
    setStatus('');
  }
}

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

/* --- Absenden ------------------------------------------------------ */

async function sendeGruss(e) {
  e.preventDefault();
  hideError();

  const name      = el.name.value.trim();
  const nachricht = el.msg.value.trim();

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
        method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: originalBlob
      }),
      fetch(urlOut.thumb.url, {
        method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: thumbBlob
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
        wort1: el.wort1.value.trim(),
        wort2: el.wort2.value.trim(),
        foto_path: urlOut.original.path,
        thumb_path: thumbRes.ok ? urlOut.thumb.path : '',
        website: el.form.website.value
      })
    });
    const subOut = await subRes.json().catch(() => ({}));
    if (!subRes.ok) throw new Error(subOut.error || 'Speichern fehlgeschlagen.');

    el.form.hidden = true;
    el.hero.hidden = true;
    el.success.hidden = false;
    el.success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    showError(err.message || 'Es ist ein Fehler aufgetreten. Bitte erneut versuchen.');
  } finally {
    setSubmitting(false);
    setStatus('');
  }
}

function setzeZurueck() {
  el.form.reset();
  originalBlob = thumbBlob = null;
  el.fotoInput.value = '';
  el.previewWrap.hidden = true;
  el.fotoBtn.hidden = false;
  el.charCount.textContent = '0';
  el.success.hidden = true;
  el.hero.hidden = false;
  el.form.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --- Helpers ------------------------------------------------------- */

function setSubmitting(on) {
  el.form.classList.toggle('is-submitting', on);
  el.submitBtn.disabled = on;
}

function setStatus(msg) {
  el.status.textContent = msg;
  el.status.hidden = !msg;
}

function showError(msg) {
  el.errorBox.textContent = msg;
  el.errorBox.hidden = false;
  el.errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  el.errorBox.hidden = true;
  el.errorBox.textContent = '';
}
