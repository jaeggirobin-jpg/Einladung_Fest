/* ===================================================================
   Formular-Logik & Validierung
   =================================================================== */

const form         = document.getElementById('anmeldung-form');
const btn          = document.getElementById('submit-btn');
const errorBox     = document.getElementById('form-error');
const successPanel = document.getElementById('success-panel');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const payload = {
    vorname:  form.vorname.value.trim(),
    nachname: form.nachname.value.trim(),
    email:    form.email.value.trim(),
    anzahl_begleitpersonen: form.anzahl_begleitpersonen.value,
    website:  form.website.value
  };

  if (!payload.vorname || !payload.nachname || !payload.email) {
    return showError('Bitte alle Pflichtfelder ausfüllen.');
  }
  if (!EMAIL_RE.test(payload.email)) {
    return showError('Bitte eine gültige E-Mail-Adresse angeben.');
  }

  setSubmitting(true);

  try {
    const res = await fetch('/.netlify/functions/submit-rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await res.json().catch(() => ({}));

    if (res.ok) {
      showSuccess();
    } else {
      showError(out.error || 'Es ist ein Fehler aufgetreten. Bitte erneut versuchen.');
      setSubmitting(false);
    }
  } catch {
    showError('Verbindung fehlgeschlagen. Bitte prüfen Sie Ihre Internetverbindung.');
    setSubmitting(false);
  }
});

function setSubmitting(on) {
  form.classList.toggle('is-submitting', on);
  btn.disabled = on;
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

function showSuccess() {
  form.hidden = true;
  successPanel.hidden = false;
  successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
