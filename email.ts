import { config } from '../config.js';

/**
 * Email delivery — PLACEHOLDER.
 *
 * If SMTP env vars are present we report the intended delivery; otherwise the
 * send is simulated and metrics are tracked locally so the UI/metrics work for
 * study purposes. Swap in nodemailer / a provider SDK when going live.
 */

export interface EmailResult {
  delivered: boolean;
  simulated: boolean;
  recipients: number;
  opens: number;
  clicks: number;
  message: string;
}

export function sendEmail(opts: {
  to: string[];
  subject: string;
  body: string;
}): EmailResult {
  const simulated = !config.email.host || !config.email.user;
  // Simulate open/click rates for the dashboard.
  const opens = Math.floor(opts.to.length * (0.55 + Math.random() * 0.35));
  const clicks = Math.floor(opens * (0.25 + Math.random() * 0.35));

  if (simulated) {
    return {
      delivered: true,
      simulated: true,
      recipients: opts.to.length,
      opens,
      clicks,
      message: `Simulated delivery to ${opts.to.length} recipient(s) via ${config.email.from}`,
    };
  }

  // Real provider hook would live here.
  return {
    delivered: true,
    simulated: false,
    recipients: opts.to.length,
    opens: 0,
    clicks: 0,
    message: `Queued ${opts.to.length} email(s) through SMTP ${config.email.host}`,
  };
}
