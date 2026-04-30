import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendMarketingEmail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.SMTP_FROM?.trim();
  const transport = getTransport();
  if (!transport || !from) {
    throw new Error("SMTP 未設定：請於環境變數設定 SMTP_HOST、SMTP_FROM（選用 SMTP_PORT、SMTP_USER、SMTP_PASS）");
  }

  await transport.sendMail({
    from,
    to,
    subject,
    html,
  });
}
