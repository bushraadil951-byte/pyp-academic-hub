// Sends email through an email service's web API (no SMTP: Render's free plan blocks SMTP ports).
//   Brevo  (free: 300 emails/day, only needs a verified sender address, no domain):  BREVO_API_KEY
//   Resend (needs a verified domain to email anyone):                                RESEND_API_KEY
// Set MAIL_FROM_EMAIL (a sender you verified with the provider) and optionally MAIL_FROM_NAME.
// With no provider configured, development prints the email to the console; production sends nothing.
import { config } from '../config.js';

const env = process.env;
const provider = env.MAIL_PROVIDER || (env.BREVO_API_KEY ? 'brevo' : env.RESEND_API_KEY ? 'resend' : 'console');
const fromEmail = env.MAIL_FROM_EMAIL || '';
const fromName = env.MAIL_FROM_NAME || 'Eastern Public School';

export const mailConfigured = provider !== 'console' && !!fromEmail;
if (config.isProd && !mailConfigured) console.warn('[mail] No email provider configured: password reset codes cannot be emailed. Set BREVO_API_KEY (or RESEND_API_KEY) and MAIL_FROM_EMAIL.');

// Never throws: a mail failure must not break the request that triggered it.
export async function sendMail({ to, subject, text, html }) {
  try {
    if (provider === 'brevo' && fromEmail) {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: fromName, email: fromEmail }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      });
      if (!r.ok) console.error('[mail] Brevo rejected the message:', r.status, await r.text());
      return r.ok;
    }
    if (provider === 'resend' && fromEmail) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, text, html }),
      });
      if (!r.ok) console.error('[mail] Resend rejected the message:', r.status, await r.text());
      return r.ok;
    }
    if (!config.isProd) console.log(`\n[mail:console] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  } catch (e) {
    console.error('[mail] send failed:', e.message);
    return false;
  }
}

const wrapHtml = (inner) => `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1e293b">
<h2 style="margin:0 0 12px;color:#4f46e5">Eastern Public School</h2>${inner}
<p style="color:#94a3b8;font-size:12px;margin-top:24px">PYP Academic Hub. This is an automated message, please do not reply.</p></div>`;

export const resetCodeEmail = (code, minutes) => ({
  subject: `Your password reset code: ${code}`,
  text: `Your PYP Academic Hub password reset code is ${code}.\nIt is valid for ${minutes} minutes and can be used once.\nIf you did not ask for this, you can ignore this email: your password has not changed.`,
  html: wrapHtml(`<p>Your password reset code is:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:12px 0">${code}</p>
<p>It is valid for ${minutes} minutes and can be used once.</p><p>If you did not ask for this, ignore this email: your password has not changed.</p>`),
});

export const passwordChangedEmail = () => ({
  subject: 'Your password was changed',
  text: 'The password for your PYP Academic Hub account was just changed. If this was not you, contact your school administrator straight away.',
  html: wrapHtml('<p>The password for your PYP Academic Hub account was just changed.</p><p>If this was not you, contact your school administrator straight away.</p>'),
});
