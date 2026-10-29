import { createPasswordResetService, RESET_MESSAGES } from '../../src/services/passwordReset';

interface Opts {
  resetThrows?: boolean;
  resetError?: boolean;
  verifyError?: boolean;
  verifyNoSession?: boolean;
  verifyThrows?: boolean;
  updateError?: boolean;
}

function fake(o: Opts = {}) {
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  const rec = (fn: string, args: unknown[]) => calls.push({ fn, args });
  const client = {
    auth: {
      resetPasswordForEmail: async (...a: unknown[]) => {
        rec('reset', a);
        if (o.resetThrows) throw new Error('rede');
        return { data: {}, error: o.resetError ? { message: 'boom interno' } : null };
      },
      verifyOtp: async (...a: unknown[]) => {
        rec('verify', a);
        if (o.verifyThrows) throw new Error('rede');
        if (o.verifyError) return { data: { session: null }, error: { message: 'token expirado detalhe interno' } };
        return { data: { session: o.verifyNoSession ? null : { access_token: 'x' } }, error: null };
      },
      updateUser: async (...a: unknown[]) => {
        rec('update', a);
        return { data: {}, error: o.updateError ? { message: 'senha fraca detalhe interno' } : null };
      },
      signOut: async (...a: unknown[]) => {
        rec('signOut', a);
        return { error: null };
      },
    },
  };
  return { svc: createPasswordResetService(client as never), calls };
}

describe('recuperação de senha por código', () => {
  it('pede o código e responde igual exista ou não o e-mail (mesmo com erro do servidor)', async () => {
    const ok = await fake().svc.requestCode('  Fulano@Exemplo.com ');
    const err = await fake({ resetError: true }).svc.requestCode('naoexiste@exemplo.com');
    expect(ok).toEqual({ ok: true, message: RESET_MESSAGES.sent });
    expect(err).toEqual(ok);
  });

  it('normaliza o e-mail enviado ao servidor', async () => {
    const f = fake();
    await f.svc.requestCode('  Fulano@Exemplo.com ');
    expect(f.calls[0]).toEqual({ fn: 'reset', args: ['fulano@exemplo.com'] });
  });

  it('rejeita e-mail inválido sem chamar o servidor', async () => {
    const f = fake();
    expect((await f.svc.requestCode('isso-nao-e-email')).ok).toBe(false);
    expect(f.calls).toHaveLength(0);
  });

  it('falha de rede ao pedir o código devolve mensagem genérica', async () => {
    const r = await fake({ resetThrows: true }).svc.requestCode('a@b.com');
    expect(r).toEqual({ ok: false, message: RESET_MESSAGES.network });
  });

  it('código correto: valida, troca a senha e derruba outras sessões', async () => {
    const f = fake();
    const r = await f.svc.confirm('A@B.com', ' 1234 5678 ', 'novaSenha123');
    expect(r).toEqual({ ok: true, message: RESET_MESSAGES.done });
    expect(f.calls.map((c) => c.fn)).toEqual(['verify', 'update', 'signOut']);
    expect(f.calls[0].args[0]).toEqual({ email: 'a@b.com', token: '12345678', type: 'recovery' });
    expect(f.calls[1].args[0]).toEqual({ password: 'novaSenha123' });
    expect(f.calls[2].args[0]).toEqual({ scope: 'others' });
  });

  it.each([
    ['código curto', 'a@b.com', '123', 'novaSenha123'],
    ['código com letras', 'a@b.com', '12ab5678', 'novaSenha123'],
    ['senha curta', 'a@b.com', '12345678', 'curta'],
    ['senha longa demais', 'a@b.com', '12345678', 'x'.repeat(73)],
    ['e-mail inválido', 'x', '12345678', 'novaSenha123'],
  ])('rejeita %s sem chamar o servidor', async (_n, email, code, password) => {
    const f = fake();
    const r = await f.svc.confirm(email, code, password);
    expect(r).toEqual({ ok: false, message: RESET_MESSAGES.invalidInput });
    expect(f.calls).toHaveLength(0);
  });

  it('código errado ou expirado: mensagem genérica, não troca a senha', async () => {
    const f = fake({ verifyError: true });
    const r = await f.svc.confirm('a@b.com', '12345678', 'novaSenha123');
    expect(r).toEqual({ ok: false, message: RESET_MESSAGES.badCode });
    expect(f.calls.map((c) => c.fn)).toEqual(['verify']);
    expect(JSON.stringify(r)).not.toMatch(/interno/);
  });

  it('verificação sem sessão é tratada como código inválido', async () => {
    const f = fake({ verifyNoSession: true });
    expect((await f.svc.confirm('a@b.com', '12345678', 'novaSenha123')).ok).toBe(false);
    expect(f.calls.map((c) => c.fn)).toEqual(['verify']);
  });

  it('se a troca da senha falhar, encerra a sessão aberta e não vaza detalhes', async () => {
    const f = fake({ updateError: true });
    const r = await f.svc.confirm('a@b.com', '12345678', 'novaSenha123');
    expect(r).toEqual({ ok: false, message: RESET_MESSAGES.setFailed });
    expect(f.calls.map((c) => c.fn)).toEqual(['verify', 'update', 'signOut']);
    expect(f.calls[2].args[0]).toEqual({ scope: 'local' });
    expect(JSON.stringify(r)).not.toMatch(/interno/);
  });

  it('falha de rede na confirmação devolve mensagem genérica', async () => {
    const r = await fake({ verifyThrows: true }).svc.confirm('a@b.com', '12345678', 'novaSenha123');
    expect(r).toEqual({ ok: false, message: RESET_MESSAGES.network });
  });
});
