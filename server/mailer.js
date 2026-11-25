'use strict';

const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createMailer(config) {
  const smtp = config.smtp || {};
  const configured = Boolean(smtp.host && smtp.from);

  if (!configured) {
    return {
      enabled: false,
      async sendResetEmail() {
        return false;
      }
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: Boolean(smtp.secure),
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
  });

  return {
    enabled: true,
    async sendResetEmail({ to, name, resetUrl }) {
      const safeName = escapeHtml(name || 'warga CityBin');
      const safeUrl = escapeHtml(resetUrl);

      await transporter.sendMail({
        from: smtp.from,
        to,
        subject: 'Reset password CityBin',
        text: [
          `Halo ${name || 'warga CityBin'},`,
          '',
          'Kami menerima permintaan reset password akun CityBin Anda.',
          `Buka tautan berikut dalam 30 menit: ${resetUrl}`,
          '',
          'Jika Anda tidak meminta reset password, abaikan email ini.'
        ].join('\n'),
        html: [
          `<p>Halo ${safeName},</p>`,
          '<p>Kami menerima permintaan reset password akun CityBin Anda.</p>',
          `<p><a href="${safeUrl}">Reset password</a> (berlaku 30 menit).</p>`,
          '<p>Jika Anda tidak meminta reset password, abaikan email ini.</p>'
        ].join('')
      });
    }
  };
}

module.exports = { createMailer };
