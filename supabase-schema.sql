-- Jalankan seluruh skrip melalui SQL Editor sebagai postgres. Tidak menghapus data.
begin;
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.shared_state (
  id text primary key check (id = 'santripulang'),
  schema_version integer not null default 1 check (schema_version = 1),
  revision bigint not null default 0 check (revision between 0 and 9007199254740990),
  payload jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  check (payload is null or (jsonb_typeof(payload) = 'object' and
    char_length(payload::text) <= 200000 and octet_length(payload::text) <= 700000))
);
insert into public.shared_state(id) values ('santripulang') on conflict (id) do nothing;
alter table public.admins enable row level security;
alter table public.shared_state enable row level security;
-- Dedikasi kedua tabel untuk aplikasi ini: hapus policy lama agar tidak ada OR permissive.
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('admins', 'shared_state') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
revoke all on public.admins, public.shared_state from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.admins, public.shared_state to authenticated;
create policy admins_read_self on public.admins for select to authenticated
  using (user_id = (select auth.uid()));
create policy shared_read_admin on public.shared_state for select to authenticated
  using (exists (select 1 from public.admins where user_id = (select auth.uid())));
-- Tidak ada INSERT/UPDATE/DELETE policy/grant untuk klien, termasuk admins.
-- Definer diperlukan karena semua mutasi langsung dicabut. Auth diperiksa di dalam RPC.
create or replace function public.save_santripulang(p_payload jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare next_revision bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admins where user_id = auth.uid()
  ) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or
     p_payload is null or jsonb_typeof(p_payload) <> 'object' or
     char_length(p_payload::text) > 200000 or octet_length(p_payload::text) > 700000 then
    raise exception 'Invalid payload or prototype size limit' using errcode = '22023';
  end if;
  update public.shared_state set payload = p_payload, revision = revision + 1,
    updated_by = auth.uid(), updated_at = now()
    where id = 'santripulang' and revision = p_expected_revision
    returning revision into next_revision;
  if not found then raise exception 'Revision conflict' using errcode = '40001'; end if;
  return next_revision;
end $$;
alter function public.save_santripulang(jsonb, bigint) owner to postgres;
revoke all on function public.save_santripulang(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_santripulang(jsonb, bigint) to authenticated;
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'shared_state') then
    alter publication supabase_realtime add table public.shared_state;
  end if;
end $$;
commit;
