import nodemailer from 'nodemailer';
import { prisma } from '@pm-platform/db';
import { env } from '../config/env.js';

export type EmailSendResult = {
  skipped: boolean;
  accepted?: string[];
  rejected?: string[];
  messageId?: string;
};

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
});

function smtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

async function sendMailSafe(to: string, subject: string, text: string, html?: string): Promise<EmailSendResult> {
  if (!smtpConfigured()) {
    console.log(`[mail:dev] SMTP is not configured. Email to ${to}: ${subject}\n${text}`);
    return { skipped: true, accepted: [to], rejected: [] };
  }
  const info = await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
  return {
    skipped: false,
    accepted: (info.accepted ?? []).map(String),
    rejected: (info.rejected ?? []).map(String),
    messageId: info.messageId
  };
}

export const emailService = {
  async sendNotification(userId: string, subject: string, text: string, html?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { skipped: true, accepted: [], rejected: ['missing-user'] } satisfies EmailSendResult;
    return sendMailSafe(user.email, subject, text, html);
  },

  async sendAuthEmail(to: string, subject: string, text: string, html?: string) {
    return sendMailSafe(to, subject, text, html);
  }
};
