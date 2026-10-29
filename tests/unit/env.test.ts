import { assertPublishableKey, EnvError, loadEnv } from '../../src/lib/env';

function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.assinatura`;
}

describe('configuração do cliente (somente chave publicável)', () => {
  it('aceita a chave publicável nova', () => {
    expect(assertPublishableKey('sb_publishable_abc123')).toBe('sb_publishable_abc123');
  });

  it('aceita o JWT legado com role anon', () => {
    const key = fakeJwt({ role: 'anon' });
    expect(assertPublishableKey(key)).toBe(key);
  });

  it('rejeita a chave secreta nova (sb_secret_)', () => {
    expect(() => assertPublishableKey('sb_secret_abc')).toThrow(EnvError);
  });

  it('rejeita JWT com role service_role', () => {
    expect(() => assertPublishableKey(fakeJwt({ role: 'service_role' }))).toThrow(EnvError);
  });

  it('rejeita JWT com role diferente de anon (ex.: authenticated)', () => {
    expect(() => assertPublishableKey(fakeJwt({ role: 'authenticated' }))).toThrow(EnvError);
  });

  it('rejeita chave ausente, vazia ou em formato desconhecido', () => {
    expect(() => assertPublishableKey(undefined)).toThrow(EnvError);
    expect(() => assertPublishableKey('   ')).toThrow(EnvError);
    expect(() => assertPublishableKey('qualquer-coisa')).toThrow(EnvError);
  });

  it('nunca inclui o valor da chave na mensagem de erro', () => {
    const secret = 'sb_secret_SUPER_SEGREDO_123';
    try {
      assertPublishableKey(secret);
    } catch (e) {
      expect((e as Error).message).not.toContain('SUPER_SEGREDO');
    }
    const jwt = fakeJwt({ role: 'service_role' });
    try {
      assertPublishableKey(jwt);
    } catch (e) {
      expect((e as Error).message).not.toContain(jwt);
    }
  });

  it('exige https em produção e só permite http para hosts locais em desenvolvimento', () => {
    const key = 'sb_publishable_x';
    expect(() => loadEnv({ url: 'http://exemplo.supabase.co', key })).toThrow(EnvError);
    expect(() => loadEnv({ url: 'http://localhost:54321', key })).toThrow(EnvError);
    expect(loadEnv({ url: 'http://localhost:54321', key }, { allowInsecureLocal: true }).supabaseUrl).toBe(
      'http://localhost:54321',
    );
    expect(() => loadEnv({ url: 'http://exemplo.supabase.co', key }, { allowInsecureLocal: true })).toThrow(EnvError);
    expect(loadEnv({ url: 'https://abc.supabase.co/', key }).supabaseUrl).toBe('https://abc.supabase.co');
  });

  it('rejeita URL ausente ou com formato inválido', () => {
    expect(() => loadEnv({ url: undefined, key: 'sb_publishable_x' })).toThrow(EnvError);
    expect(() => loadEnv({ url: 'javascript:alert(1)', key: 'sb_publishable_x' })).toThrow(EnvError);
  });
});
