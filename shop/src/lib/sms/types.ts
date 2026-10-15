export type SmsProviderName = 'KAVENEGAR' | 'MELIPAYAMAK';

export interface SendSmsInput {
  mobile: string;
  message: string;
  /** در صورت استفاده از پیامک خدماتی/الگو */
  template?: string;
  /** مقادیر جایگزین الگو (token, token2, token3) */
  tokens?: string[];
}

export interface SendSmsResult {
  ok: boolean;
  providerMessageId?: string;
  cost?: number;
  errorMessage?: string;
  raw: unknown;
}

export interface SmsProviderAdapter {
  readonly name: SmsProviderName;
  send(input: SendSmsInput): Promise<SendSmsResult>;
}

export const SMS_TIMEOUT = 12_000;
