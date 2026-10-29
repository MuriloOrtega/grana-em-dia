// Recuperação de senha por código enviado ao e-mail (não depende de link nem de deep link no app).
// Mensagens genéricas: nunca revelam se o e-mail está cadastrado nem detalhes do servidor.
import type { SupabaseClient } from '@supabase/supabase-js';
import { EmailSchema, ResetConfirmSchema } from '../schemas/auth';

export type ResetResult = { ok: true; message: string } | { ok: false; message: string };

export const RESET_MESSAGES = {
  invalidEmail: 'Informe um e-mail válido.',
  sent: 'Se o e-mail estiver cadastrado, enviamos um código de 8 dígitos. Ele vale por 1 hora.',
  invalidInput: 'Confira o e-mail, o código e a nova senha (de 8 a 72 caracteres).',
  badCode: 'Código inválido ou expirado. Peça um novo código.',
  setFailed: 'Não foi possível definir a nova senha. Peça um novo código e tente de novo.',
  done: 'Senha alterada com sucesso.',
  network: 'Não foi possível concluir agora. Verifique a conexão e tente novamente.',
} as const;

export interface PasswordResetService {
  requestCode(email: string): Promise<ResetResult>;
  /** Valida o código, define a nova senha e encerra as outras sessões. */
  confirm(email: string, code: string, password: string): Promise<ResetResult>;
}

export function createPasswordResetService(client: SupabaseClient): PasswordResetService {
  return {
    async requestCode(email) {
      const parsed = EmailSchema.safeParse({ email });
      if (!parsed.success) return { ok: false, message: RESET_MESSAGES.invalidEmail };
      try {
        // O erro é ignorado de propósito: a resposta é a mesma exista ou não a conta.
        await client.auth.resetPasswordForEmail(parsed.data.email);
        return { ok: true, message: RESET_MESSAGES.sent };
      } catch {
        return { ok: false, message: RESET_MESSAGES.network };
      }
    },

    async confirm(email, code, password) {
      const parsed = ResetConfirmSchema.safeParse({ email, code, password });
      if (!parsed.success) return { ok: false, message: RESET_MESSAGES.invalidInput };
      try {
        const verified = await client.auth.verifyOtp({
          email: parsed.data.email,
          token: parsed.data.code,
          type: 'recovery',
        });
        if (verified.error || !verified.data.session) return { ok: false, message: RESET_MESSAGES.badCode };

        const updated = await client.auth.updateUser({ password: parsed.data.password });
        if (updated.error) {
          // Não deixa uma sessão aberta sem a senha ter sido trocada.
          await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
          return { ok: false, message: RESET_MESSAGES.setFailed };
        }
        // Derruba sessões antigas em outros aparelhos (melhor esforço).
        await client.auth.signOut({ scope: 'others' }).catch(() => undefined);
        return { ok: true, message: RESET_MESSAGES.done };
      } catch {
        return { ok: false, message: RESET_MESSAGES.network };
      }
    },
  };
}
