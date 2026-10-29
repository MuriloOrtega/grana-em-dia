// Autenticação: login, cadastro, encerramento e tratamento de sessão expirada.
// A sessão fica no armazenamento seguro; o token é renovado automaticamente enquanto o app está ativo.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { CredentialsSchema } from '../schemas/auth';
import { createPasswordResetService, type ResetResult } from '../services/passwordReset';

type Status = 'loading' | 'signedOut' | 'signedIn' | 'misconfigured';

export type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

interface AuthContextValue {
  status: Status;
  session: Session | null;
  email: string | null;
  /** Aviso mostrado na tela de login (ex.: sessão expirada). */
  notice: string | null;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<ResetResult>;
  /** Valida o código do e-mail e define a nova senha; em caso de sucesso o usuário já fica logado. */
  resetPassword(email: string, code: string, password: string): Promise<ResetResult>;
  signOut(): Promise<void>;
  /** Chamado quando o servidor rejeita a sessão (token expirado/revogado). */
  expireSession(): Promise<void>;
  clearNotice(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente.';
const INVALID_INPUT = 'Informe um e-mail válido e uma senha de 8 a 72 caracteres.';

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hadSession = useRef(false);
  const userInitiatedSignOut = useRef(false);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch {
      setStatus('misconfigured');
      return undefined;
    }

    // O callback é síncrono de propósito: não chamar o Supabase dentro dele evita deadlocks.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') {
        if (hadSession.current && !userInitiatedSignOut.current) setNotice(SESSION_EXPIRED);
        hadSession.current = false;
        userInitiatedSignOut.current = false;
        setSession(null);
        setStatus('signedOut');
        return;
      }
      if (next) {
        hadSession.current = true;
        setSession(next);
        setStatus('signedIn');
      } else if (event === 'INITIAL_SESSION') {
        setStatus('signedOut');
      }
    });

    // Renova o token só com o app em primeiro plano.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();

    return () => {
      data.subscription.unsubscribe();
      appStateSub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const parsed = CredentialsSchema.safeParse({ email, password });
    if (!parsed.success) return { ok: false, message: INVALID_INPUT };
    try {
      const { error } = await getSupabase().auth.signInWithPassword(parsed.data);
      if (error) {
        // Mensagem única: não revela se o e-mail existe.
        return { ok: false, message: 'E-mail ou senha incorretos.' };
      }
      setNotice(null);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Não foi possível entrar agora. Verifique a conexão e tente novamente.' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const parsed = CredentialsSchema.safeParse({ email, password });
    if (!parsed.success) return { ok: false, message: INVALID_INPUT };
    try {
      const { error } = await getSupabase().auth.signUp(parsed.data);
      if (error) {
        return { ok: false, message: 'Não foi possível concluir o cadastro. Confira os dados e tente novamente.' };
      }
      setNotice(null);
      return { ok: true, message: 'Cadastro enviado. Abra o e-mail e toque no link de confirmação. A página que abrir pode aparecer em branco ou com um aviso: é normal. Depois volte ao app e entre.' };
    } catch {
      return { ok: false, message: 'Não foi possível concluir o cadastro agora. Tente novamente.' };
    }
  }, []);

  const requestPasswordReset = useCallback(
    (email: string): Promise<ResetResult> => createPasswordResetService(getSupabase()).requestCode(email),
    [],
  );

  const resetPassword = useCallback(
    async (email: string, code: string, password: string): Promise<ResetResult> => {
      const result = await createPasswordResetService(getSupabase()).confirm(email, code, password);
      if (!result.ok) {
        // Se a sessão do código chegou a abrir e foi encerrada, a tela de login mostra o motivo.
        setNotice(result.message);
      } else {
        setNotice(null);
      }
      return result;
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    userInitiatedSignOut.current = true;
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Mesmo sem rede, encerra a sessão local.
      await getSupabase().auth.signOut({ scope: 'local' });
    }
  }, []);

  const expireSession = useCallback(async (): Promise<void> => {
    try {
      await getSupabase().auth.signOut({ scope: 'local' });
    } catch {
      setSession(null);
      setStatus('signedOut');
      setNotice(SESSION_EXPIRED);
    }
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      email: session?.user.email ?? null,
      notice,
      signIn,
      signUp,
      requestPasswordReset,
      resetPassword,
      signOut,
      expireSession,
      clearNotice,
    }),
    [status, session, notice, signIn, signUp, requestPasswordReset, resetPassword, signOut, expireSession, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
