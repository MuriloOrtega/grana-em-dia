import { z } from 'zod';

export const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
});

export type Credentials = z.infer<typeof CredentialsSchema>;

export const EmailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

// Código numérico enviado por e-mail (o Supabase usa 6 a 8 dígitos, conforme a configuração).
export const ResetConfirmSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\d{6,10}$/)),
  password: z.string().min(8).max(72),
});
