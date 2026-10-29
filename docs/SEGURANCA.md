# Grana em Dia — camada de segurança

> Status: banco e autenticação validados em teste real; leia "Riscos em aberto" antes de usar com dados reais de muita gente.

## Resumo

O app usa só a URL do projeto e a chave **publicável** do Supabase. Os dados ficam em tabelas com **RLS** (ativado e forçado); o dono do registro é definido pelo banco (`auth.uid()`), nunca pelo cliente.

## Configuração no Supabase

1. **Projeto:** anote a *Project URL* e a *Publishable key* (Settings → API Keys). Nunca coloque `service_role`/`secret` no app ou em variáveis `EXPO_PUBLIC_*`.
2. **Auth:** e-mail habilitado, senha mínima de 8 caracteres, confirmação de e-mail ligada. Em produção, ative CAPTCHA, configure SMTP próprio e revise os limites de taxa.
3. **Banco:** aplique `supabase/migrations/20261029000000_security_baseline.sql` (CLI `supabase db push` ou cole no SQL Editor). Depois rode o Security Advisor e confirme que nenhuma tabela está sem RLS.

## Variáveis de ambiente

| Onde | Nome | Secreta? |
|---|---|---|
| App (`.env`) | `EXPO_PUBLIC_SUPABASE_URL` | não |
| App (`.env`) | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | não (pública por projeto; vale por causa do RLS) |
| App (`.env`) | `EXPO_PUBLIC_PASSWORD_RESET=on` (opcional) | não |

Nada secreto pertence ao app. `.env` está no `.gitignore`.

## O que o banco garante

- `user_id` tem padrão `auth.uid()`; o cliente não tem permissão de coluna para gravá-lo ou alterá-lo.
- Políticas de select/insert/update/delete só para `authenticated` e só nos próprios registros.
- `anon` não acessa nada.
- Restrições: valor positivo (até 2 casas), título de 1 a 100 caracteres, categoria e tipo compatíveis, chave de idempotência `(user_id, request_id)` contra duplicatas.

## Assistente local

`src/assistant/localAssistant.ts` roda no aparelho, por regras e palavras-chave. Nenhuma mensagem sai do app. Só propõe lançamentos; o usuário confirma antes de salvar. Toda resposta passa por esquema estrito (`src/assistant/contract.ts`). Responde também perguntas sobre os lançamentos reais (saldo, gastos por período e categoria, maior gasto, últimos lançamentos, dicas).

## Recuperação de senha (desligada por padrão)

Fluxo por código enviado ao e-mail (`src/services/passwordReset.ts`). Para ligar: configure SMTP próprio no Supabase, inclua `{{ .Token }}` no template "Reset Password" e defina `EXPO_PUBLIC_PASSWORD_RESET=on`.

## Testes

```bash
npm test              # unitários (validação, serviços, assistente local, recuperação de senha)
npm run test:sql      # RLS em Postgres local (precisa de PostgreSQL)
npm run test:real     # isolamento entre 2 usuários no Supabase real (veja o cabeçalho do arquivo)
npm run typecheck
```

## Riscos em aberto

- Sem CAPTCHA, MFA, bloqueio biométrico e recuperação de senha ativa por padrão.
- SMTP padrão do Supabase (limite baixo de e-mails) e página de confirmação provisória.
- Metas e orçamento ainda são dados de demonstração.
- Sem exclusão/exportação de conta e sem política de privacidade.
- Lista limitada a 500 lançamentos, sem paginação.
- Armazenamento seguro da sessão não testado em Android.
- `npm audit` com vulnerabilidades não revisadas.
