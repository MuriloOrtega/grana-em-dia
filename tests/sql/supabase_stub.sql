-- Emula, em um PostgreSQL puro, as peças do Supabase de que a migração depende:
-- papéis anon/authenticated, schema auth, auth.users e auth.uid() (lido do "JWT" da sessão).
-- Também reproduz os privilégios padrão que o Supabase concede em novas tabelas do schema public,
-- para provar que a migração os revoga.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

drop schema if exists auth cascade;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated, public;
