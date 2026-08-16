/* ===================================================================
   Gästebuch: Selfie komprimieren, direkt zu Storage hochladen,
   Gruss speichern
   =================================================================== */

const form         = document.getElementById('gruss-form');
const fotoInput    = document.getElementById('foto-input');
const fotoBtn      = document.getElementById('foto-btn');
const fotoBtnLabel = document.getElementById('foto-btn-label');
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

let fotoBlob = null; // komprimiertes JPEG

/* --- Selfie ------------------------------------------------------- */

fotoBtn.addEventListener('click', () => fotoInput.click());
retakeBtn.addEventListener('click', () => fotoInput.click());

fotoInput.addEventListener('change', async () => {
  const file = fotoInput.files[0];
  if (!file) return;
  hideError();
  try {
    fotoBlob = await compressImage(file);
    previewImg.src = URL.createObjectURL(fotoBlob);
    previewWrap.hidden = false;
    fotoBtn.hidden = true;
  } catch (e) {
    console.error(e);
    fotoBlob = null;
    showError('Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.');
  }
});

async function compressImage(file) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const MAX = 1600;
  let { width, height } = img;
  if (width > MAX || height > MAX) {
    const scale = MAX / Math.max(width, height);
    width  = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);

  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
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

  if (!fotoBlob) return showError('Bitte zuerst ein Selfie machen (Schritt 1).');
  if (!name)      return showError('Bitte deinen Namen angeben (Schritt 2).');
  if (!nachricht) return showError('Bitte eine Nachricht schreiben (Schritt 3).');

  setSubmitting(true);

  try {
    // 1. Signierte Upload-URL holen
    setStatus('Foto wird hochgeladen …');
    const urlRes = await fetch('/.netlify/functions/gruss-upload-url', { method: 'POST' });
    const urlOut = await urlRes.json().catch(() => ({}));
    if (!urlRes.ok) throw new Error(urlOut.error || 'Upload konnte nicht vorbereitet werden.');

    // 2. Foto direkt zu Supabase Storage
    const putRes = await fetch(urlOut.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: fotoBlob
    });
    if (!putRes.ok) throw new Error('Foto-Upload fehlgeschlagen. Bitte erneut versuchen.');

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
        foto_path: urlOut.path,
        website: form.website.value
      })
    });
    const subOut = await subRes.json().catch(() => ({}));
    if (!subRes.ok) throw new Error(subOut.error || 'Speichern fehlgeschlagen.');

    form.hidden = true;
    document.querySelector('.hero-text').hidden = true;
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
  fotoBlob = null;
  fotoInput.value = '';
  previewWrap.hidden = true;
  fotoBtn.hidden = false;
  charCount.textContent = '0';
  successPanel.hidden = true;
  document.querySelector('.hero-text').hidden = false;
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
