/**
 * Verifies a Google reCAPTCHA v2 token against Google's siteverify endpoint.
 *
 * NOTE: RECAPTCHA_SECRET_KEY in .env is a placeholder until you generate
 * real keys at https://www.google.com/recaptcha/admin. Until real keys are
 * set, this function short-circuits to `true` in development so the rest of
 * signup/login flow can be built and tested without live keys. As soon as
 * you drop real keys into .env, this enforces properly — no code changes
 * needed on your end....
 */
async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const isPlaceholder = !secret || secret === 'your_recaptcha_secret_key_here';

  if (isPlaceholder) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[recaptcha] Using placeholder secret key — skipping verification in dev mode.');
      return true;
    }
    // In production we refuse to silently bypass captcha protection.
    console.error('[recaptcha] RECAPTCHA_SECRET_KEY is not configured for production.');
    return false;
  }

  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.error('[recaptcha] Verification request failed:', err.message);
    return false;
  }
}

module.exports = verifyRecaptcha;
