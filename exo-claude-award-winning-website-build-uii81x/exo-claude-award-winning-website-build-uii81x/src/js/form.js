/**
 * Intake form.
 *
 * Transport is configured, not hard-coded. Set VITE_FORM_ENDPOINT to a Formspree
 * form URL (https://formspree.io/f/xxxxxxx), an EmailJS-compatible endpoint or
 * your own API route that accepts JSON; see .env.example. With no endpoint set
 * the form still works — it hands the composed message to the visitor's mail
 * client rather than silently pretending to have sent something.
 */

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT ?? '';
const FALLBACK_TO = import.meta.env.VITE_CONTACT_EMAIL ?? 'contact@exog8.in';

const RULES = {
  name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
  role: (v) => (v ? '' : 'Please choose the area you are interested in.'),
  message: (v) => (v.trim().length >= 12 ? '' : 'A sentence or two, please — at least 12 characters.'),
};

export function initForm(form) {
  if (!form) return;

  const statusEl = form.querySelector('#f-status');
  const submitEl = form.querySelector('#f-submit');
  const fields = Object.keys(RULES).map((name) => ({
    name,
    input: form.elements[name],
    error: form.querySelector(`#e-${name}`),
  }));

  function setError(field, msg) {
    const wrap = field.input.closest('.field');
    wrap.classList.toggle('is-invalid', Boolean(msg));
    field.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) {
      field.error.textContent = msg;
      field.error.hidden = false;
      field.input.setAttribute('aria-describedby', field.error.id);
    } else {
      field.error.hidden = true;
      field.input.removeAttribute('aria-describedby');
    }
  }

  function validate({ touchedOnly = false } = {}) {
    let firstBad = null;
    for (const field of fields) {
      if (touchedOnly && !field.input.dataset.touched) continue;
      const msg = RULES[field.name](field.input.value);
      setError(field, msg);
      if (msg && !firstBad) firstBad = field;
    }
    return firstBad;
  }

  for (const field of fields) {
    field.input.addEventListener('blur', () => {
      field.input.dataset.touched = '1';
      setError(field, RULES[field.name](field.input.value));
    });
    field.input.addEventListener('input', () => {
      if (field.input.dataset.touched) setError(field, RULES[field.name](field.input.value));
    });
  }

  function setStatus(text, kind = '') {
    statusEl.textContent = text;
    statusEl.className = `jform__status${kind ? ` is-${kind}` : ''}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot: a filled hidden field means a bot. Report success, send nothing.
    if (form.elements._gotcha?.value) {
      setStatus('Thanks — we will be in touch.', 'ok');
      form.reset();
      return;
    }

    for (const field of fields) field.input.dataset.touched = '1';
    const bad = validate();
    if (bad) {
      bad.input.focus();
      setStatus('Some fields still need attention.', 'error');
      return;
    }

    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      role: form.elements.role.value,
      message: form.elements.message.value.trim(),
      _subject: 'ExoG8 — intake form',
    };

    if (!ENDPOINT) {
      // No transport configured: hand off to the visitor's mail client so the
      // message is not quietly dropped.
      const body = `Name: ${payload.name}\nEmail: ${payload.email}\nRole: ${payload.role}\n\n${payload.message}`;
      window.location.href =
        `mailto:${FALLBACK_TO}?subject=${encodeURIComponent(payload._subject)}&body=${encodeURIComponent(body)}`;
      setStatus('Opening your mail client…');
      return;
    }

    form.classList.add('is-sending');
    submitEl.disabled = true;
    setStatus('Sending…');

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      form.reset();
      for (const field of fields) {
        delete field.input.dataset.touched;
        setError(field, '');
      }
      setStatus('Received. We read every one of these.', 'ok');
    } catch (err) {
      console.error('[form]', err);
      setStatus(`Could not send that. Email ${FALLBACK_TO} instead.`, 'error');
    } finally {
      form.classList.remove('is-sending');
      submitEl.disabled = false;
    }
  });
}
