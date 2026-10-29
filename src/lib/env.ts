// Leitura e validação das variáveis públicas. Só aceita URL do projeto e chave PUBLICÁVEL.
// Mensagens de erro nunca contêm o valor da chave.

export interface PublicEnv {
  supabaseUrl: string;
  publishableKey: string;
}

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const ch of padded) {
    if (ch === '=') break;
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error('invalid_base64');
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

/** Aceita somente chaves publicáveis (sb_publishable_...) ou o JWT legado com role "anon". */
export function assertPublishableKey(rawKey: string | undefined): string {
  const key = (rawKey ?? '').trim();
  if (!key) throw new EnvError('Chave publicável do Supabase ausente.');

  if (key.startsWith('sb_secret_')) {
    throw new EnvError('Chave secreta detectada. Use apenas a chave publicável no app.');
  }
  if (key.startsWith('sb_publishable_')) return key;

  const parts = key.split('.');
  if (parts.length === 3) {
    let role: unknown;
    try {
      role = (JSON.parse(decodeBase64Url(parts[1])) as { role?: unknown }).role;
    } catch {
      throw new EnvError('Chave do Supabase em formato inválido.');
    }
    if (role !== 'anon') {
      throw new EnvError('Chave com privilégios elevados detectada. Use apenas a chave publicável (anon).');
    }
    return key;
  }
  throw new EnvError('Chave do Supabase em formato não reconhecido.');
}

const HTTPS_URL = /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?\/?$/i;
const LOCAL_HTTP_URL = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?\/?$/i;

export function assertSupabaseUrl(rawUrl: string | undefined, allowInsecureLocal: boolean): string {
  const url = (rawUrl ?? '').trim();
  if (!url) throw new EnvError('URL do projeto Supabase ausente.');
  const ok = HTTPS_URL.test(url) || (allowInsecureLocal && LOCAL_HTTP_URL.test(url));
  if (!ok) throw new EnvError('URL do Supabase inválida (use https).');
  return url.replace(/\/$/, '');
}

export function loadEnv(
  raw: { url?: string; key?: string },
  options: { allowInsecureLocal?: boolean } = {},
): PublicEnv {
  return {
    supabaseUrl: assertSupabaseUrl(raw.url, options.allowInsecureLocal ?? false),
    publishableKey: assertPublishableKey(raw.key),
  };
}

let cached: PublicEnv | null = null;

/** O Expo só injeta EXPO_PUBLIC_* quando referenciadas de forma estática, por isso a leitura explícita. */
export function getEnv(): PublicEnv {
  if (!cached) {
    cached = loadEnv(
      {
        url: process.env.EXPO_PUBLIC_SUPABASE_URL,
        key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
      { allowInsecureLocal: process.env.NODE_ENV !== 'production' },
    );
  }
  return cached;
}
