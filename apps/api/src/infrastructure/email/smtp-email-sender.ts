import nodemailer from 'nodemailer';

import { ExternalProviderError } from '@/common/errors/application-error';
import type { EmailSettings } from '@/configs/app-config';
import type { EmailMessage, EmailSender } from '@/platform/email/email-sender';

export class SmtpEmailSender implements EmailSender {
  public constructor(private readonly settings: EmailSettings) {}

  public async send(message: EmailMessage): Promise<void> {
    if (
      this.settings.host === undefined ||
      this.settings.port === undefined ||
      this.settings.from === undefined
    ) {
      throw new ExternalProviderError();
    }
    const transport = nodemailer.createTransport({
      host: this.settings.host,
      port: this.settings.port,
      connectionTimeout: 5_000,
      socketTimeout: 5_000,
      auth:
        this.settings.password === undefined
          ? undefined
          : { user: this.settings.from, pass: this.settings.password },
    });
    try {
      await transport.sendMail({
        from: this.settings.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    } catch {
      throw new ExternalProviderError();
    } finally {
      transport.close();
    }
  }
}
