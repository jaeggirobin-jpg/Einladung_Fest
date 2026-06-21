/* ===================================================================
   Anmelde-Flow: E-Mail-Prüfung gegen Gästeliste, dann RSVP-Formular
   =================================================================== */

const emailForm    = document.getElementById('email-form');
const emailInput   = document.getElementById('check-email');
const emailBtn     = document.getElementById('email-btn');
const emailError   = document.getElementById('email-error');

const form         = document.getElementById('anmeldung-form');
const guestName    = document.getElementById('guest-name');
const begleitField = document.getElementById('begleit-field');
const begleitSel   = document.getElementById('anzahl_begleitpersonen');
const statusInput  = document.getElementById('status');
const submitBtn    = document.getElementById('submit-btn');
const submitLabel  = submitBtn.querySelector('.btn-submit__label');
const errorBox     = document.getElementById('form-error');

const successPanel = document.getElementById('success-panel');
const successTitle = document.getElementById('success-title');
const successText  = document.getElementById('success-text');
const iconYes      = document.getElementById('success-icon-yes');
const iconNo       = document.getElementById('success-icon-no');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let currentGuest = null; // { email, vorname, nachname, max_begleitpersonen, status }

/* --- Step 1: E-Mail prüfen ---------------------------------------- */

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideEmailError();

  const email = emailInput.value.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return showEmailError('Bitte eine gültige E-Mail-Adresse angeben.');
  }

  setEmailSubmitting(true);
  try {
    const res = await fetch('/.netlify/functions/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      showEmailError(out.error || 'Prüfung fehlgeschlagen.');
      return;
    }
    if (!out.found) {
      showEmailError('Diese E-Mail-Adresse steht nicht auf der Gästeliste. Bitte prüfen Sie die Adresse oder kontaktieren Sie uns unter info@jaeggivollmer.ch.');
      return;
    }
    currentGuest = { email, ...out };
    enterFormStep();
  } catch {
    showEmailError('Verbindung fehlgeschlagen. Bitte erneut versuchen.');
  } finally {
    setEmailSubmitting(false);
  }
});

function enterFormStep() {
  emailForm.hidden = true;

  guestName.textContent = `${currentGuest.vorname} ${currentGuest.nachname}`;

  // Begleit-Dropdown nur wenn erlaubt
  const max = currentGuest.max_begleitpersonen || 0;
  if (max > 0) {
    begleitSel.innerHTML = buildBegleitOptions(max, currentGuest.anzahl_begleitpersonen);
    begleitField.hidden = false;
  } else {
    begleitField.hidden = true;
  }

  // Wenn bereits geantwortet: vorherige Auswahl markieren
  if (currentGuest.status === 'angemeldet' || currentGuest.status === 'abgemeldet') {
    selectIntent(currentGuest.status);
  }

  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildBegleitOptions(max, current) {
  let html = '';
  for (let i = 0; i <= max; i++) {
    const label = i === 0
      ? 'Keine Begleitperson'
      : (i === 1 ? '1 Begleitperson' : `${i} Begleitpersonen`);
    const sel = i === current ? ' selected' : '';
    html += `<option value="${i}"${sel}>${label}</option>`;
  }
  return html;
}

/* --- Step 2: Intent + Submit -------------------------------------- */

document.querySelectorAll('.intent-btn').forEach(b => {
  b.addEventListener('click', () => selectIntent(b.dataset.intent));
});

function selectIntent(intent) {
  const isDecline = intent === 'abgemeldet';
  statusInput.value = intent;
  form.classList.toggle('is-decline', isDecline);
  submitLabel.textContent = isDecline ? 'Absage senden' : 'Zusage senden';
  if (isDecline) begleitSel.value = '0';

  document.querySelectorAll('.intent-btn').forEach(b => {
    b.classList.toggle('is-selected', b.dataset.intent === intent);
  });

  submitBtn.disabled = false;
  hideError();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const status = statusInput.value === 'abgemeldet' ? 'abgemeldet' : 'angemeldet';
  const payload = {
    email:   currentGuest.email,
    status,
    anzahl_begleitpersonen: status === 'abgemeldet' ? '0' : (begleitSel.value || '0'),
    website: form.website.value
  };

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
      showError(out.error || 'Es ist ein Fehler aufgetreten.');
      setSubmitting(false);
    }
  } catch {
    showError('Verbindung fehlgeschlagen.');
    setSubmitting(false);
  }
});

/* --- UI Helpers --------------------------------------------------- */

function setEmailSubmitting(on) { emailForm.classList.toggle('is-submitting', on); emailBtn.disabled = on; }
function setSubmitting(on)       { form.classList.toggle('is-submitting', on); submitBtn.disabled = on; }

function showEmailError(msg) { emailError.textContent = msg; emailError.hidden = false; }
function hideEmailError()    { emailError.hidden = true; emailError.textContent = ''; }
function showError(msg)      { errorBox.textContent = msg; errorBox.hidden = false; errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
function hideError()         { errorBox.hidden = true; errorBox.textContent = ''; }

function showSuccess(status) {
  form.hidden = true;
  emailForm.hidden = true;

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
