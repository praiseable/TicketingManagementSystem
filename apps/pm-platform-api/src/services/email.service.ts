import nodemailer from 'nodemailer';
import { prisma } from '@pm-platform/db';
import { env } from '../config/env.js';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
});

function smtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

async function sendMailSafe(to: string, subject: string, text: string, html?: string) {
  if (!smtpConfigured()) {
    console.log(`[mail:dev] SMTP is not configured. Email to ${to}: ${subject}\n${text}`);
    return { skipped: true };
  }
  return transporter.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
}

export const emailService = {
  async sendNotification(userId: string, subject: string, text: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await sendMailSafe(user.email, subject, text);
  },

  async sendAuthEmail(to: string, subject: string, text: string, html?: string) {
    await sendMailSafe(to, subject, text, html);
  }
};
