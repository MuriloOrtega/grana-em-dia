// Cliente Supabase do app: somente URL do projeto + chave publicável.
// A segurança dos dados vem do RLS no banco, não de esconder esta chave.
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import { secureStorage } from './secureStorage';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.supabaseUrl, env.publishableKey, {
      auth: {
        storage: secureStorage,
        storageKey: 'grana-auth',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
