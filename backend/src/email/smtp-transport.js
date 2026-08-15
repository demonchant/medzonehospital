import nodemailer from "nodemailer";

export function createSmtpTransport(config, createTransport = nodemailer.createTransport) {
  const transport = createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: config.secure,
    auth: {
      user: config.EMAIL_USERNAME,
      pass: config.EMAIL_PASSWORD,
    },
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  return Object.freeze({
    send(message) {
      return transport.sendMail({
        from: config.EMAIL_USERNAME,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  });
}
