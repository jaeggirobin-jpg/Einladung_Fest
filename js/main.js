/* ===================================================================
   Formular-Logik: Intent-Auswahl + Submit (anmelden/abmelden)
   =================================================================== */

const intentStep   = document.getElementById('intent-step');
const form         = document.getElementById('anmeldung-form');
const formMode     = document.getElementById('form-mode');
const submitLabel  = document.querySelector('.btn-submit__label');
const begleitField = document.getElementById('begleit-field');
const statusInput  = document.getElementById('status');
const btn          = document.getElementById('submit-btn');
const backBtn      = document.getElementById('back-btn');
const errorBox     = document.getElementById('form-error');
const successPanel = document.getElementById('success-panel');
const successTitle = document.getElementById('success-title');
const successText  = document.getElementById('success-text');
const iconYes      = document.getElementById('success-icon-yes');
const iconNo       = document.getElementById('success-icon-no');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

document.querySelectorAll('.intent-btn').forEach(b => {
  b.addEventListener('click', () => selectIntent(b.dataset.intent));
});

backBtn.addEventListener('click', () => {
  form.hidden = true;
  hideError();
  intentStep.hidden = false;
  intentStep.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

function selectIntent(intent) {
  const isDecline = intent === 'abgemeldet';
  statusInput.value = intent;
  form.classList.toggle('is-decline', isDecline);
  formMode.textContent = isDecline ? 'Absage' : 'Zusage';
  submitLabel.textContent = isDecline ? 'Absage senden' : 'Zusage senden';
  if (isDecline) form.anzahl_begleitpersonen.value = '0';

  intentStep.hidden = true;
  form.hidden = false;
  form.vorname.focus();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const status = statusInput.value === 'abgemeldet' ? 'abgemeldet' : 'angemeldet';

  const payload = {
    vorname:  form.vorname.value.trim(),
    nachname: form.nachname.value.trim(),
    email:    form.email.value.trim(),
    anzahl_begleitpersonen: status === 'abgemeldet' ? '0' : form.anzahl_begleitpersonen.value,
    status,
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
      showSuccess(status);
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

function showSuccess(status) {
  form.hidden = true;
  intentStep.hidden = true;

  if (status === 'abgemeldet') {
    successPanel.classList.add('is-decline');
    successTitle.textContent = 'Schade, dass Sie nicht dabei sein können.';
    successText.textContent  = 'Ihre Absage ist bei uns notiert. Vielen Dank für die Rückmeldung.';
    iconYes.hidden = true;
    iconNo.hidden  = false;
    document.querySelectorAll('.success__text--muted').forEach(el => el.hidden = true);
  } else {
    successPanel.classList.remove('is-decline');
    successTitle.textContent = 'Vielen Dank!';
    successText.textContent  = 'Ihre Anmeldung ist eingegangen. Eine Bestätigung wurde an Ihre E-Mail-Adresse versendet.';
    iconYes.hidden = false;
    iconNo.hidden  = true;
  }

  successPanel.hidden = false;
  successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
