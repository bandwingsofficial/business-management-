import { InfrastructureError } from '@/common/errors/application-error';

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class DisabledEmailSender implements EmailSender {
  public async send(): Promise<void> {
    throw new InfrastructureError('EMAIL_UNAVAILABLE');
  }
}

export class RecordingEmailSender implements EmailSender {
  public readonly sent: EmailMessage[] = [];

  public async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
