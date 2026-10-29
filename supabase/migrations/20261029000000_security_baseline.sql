-- Grana em Dia — base de segurança
-- Tabelas financeiras com RLS obrigatório, privilégios mínimos por coluna e cota de uso da IA.
-- Aplicar com: supabase db push (ou colar no SQL Editor do projeto).

-- ---------------------------------------------------------------------------
-- 1. Lançamentos
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  -- O dono é definido pelo banco a partir da sessão validada (JWT). O cliente nunca envia user_id.
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Chave de idempotência gerada pelo app: repetir a mesma confirmação não cria duplicata.
  request_id  uuid not null,
  title       text not null check (char_length(btrim(title)) between 1 and 100),
  category    text not null check (category in (
                'moradia', 'alimentacao', 'transporte', 'lazer',
                'saude', 'assinaturas', 'salario', 'renda_extra')),
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(12, 2) not null check (amount > 0 and amount <= 1000000000),
  date        date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint transactions_user_request_unique unique (user_id, request_id),
  -- Receita só com categorias de receita; despesa só com categorias de despesa.
  constraint transactions_type_matches_category check (
    (type = 'income') = (category in ('salario', 'renda_extra'))
  )
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS (nunca desativar). FORCE aplica as políticas também ao dono da tabela.
-- ---------------------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.transactions force row level security;

drop policy if exists transactions_select_own on public.transactions;
drop policy if exists transactions_insert_own on public.transactions;
drop policy if exists transactions_update_own on public.transactions;
drop policy if exists transactions_delete_own on public.transactions;

create policy transactions_select_own on public.transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy transactions_insert_own on public.transactions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy transactions_update_own on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy transactions_delete_own on public.transactions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. Privilégios mínimos (defesa em profundidade além do RLS)
--    - anon não acessa nada.
--    - authenticated não consegue gravar user_id nem alterá-lo depois.
-- ---------------------------------------------------------------------------
revoke all on table public.transactions from public, anon, authenticated;

grant select on table public.transactions to authenticated;
grant insert (request_id, title, category, type, amount, date)
  on table public.transactions to authenticated;
grant update (title, category, type, amount, date)
  on table public.transactions to authenticated;
grant delete on table public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cota de uso da IA (sem usar service_role)
--    A tabela de registro é inacessível ao cliente. A função SECURITY DEFINER
--    identifica o usuário por auth.uid() e aplica os limites no servidor.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists ai_usage_log_user_created_idx
  on public.ai_usage_log (user_id, created_at desc);

alter table public.ai_usage_log enable row level security;
alter table public.ai_usage_log force row level security;
-- Sem políticas: nenhum papel de cliente lê ou grava esta tabela diretamente.
revoke all on table public.ai_usage_log from public, anon, authenticated;

create or replace function public.consume_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_per_hour constant int := 20;
  v_per_day  constant int := 100;
  v_hour     int;
  v_day      int;
begin
  if v_uid is null then
    return false;
  end if;

  -- Serializa chamadas concorrentes do mesmo usuário (evita furar o limite).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*)
  into v_hour, v_day
  from public.ai_usage_log
  where user_id = v_uid
    and created_at > now() - interval '1 day';

  if v_hour >= v_per_hour or v_day >= v_per_day then
    return false;
  end if;

  insert into public.ai_usage_log (user_id) values (v_uid);
  delete from public.ai_usage_log
   where user_id = v_uid and created_at < now() - interval '7 days';

  return true;
end;
$$;

revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;
