-- Run this once in Supabase Dashboard -> SQL Editor.
-- It creates one private collection document per authenticated user.

create table if not exists public.tcg_collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  client_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.tcg_collections enable row level security;

drop policy if exists "Users can read their own collection" on public.tcg_collections;
create policy "Users can read their own collection"
  on public.tcg_collections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own collection" on public.tcg_collections;
create policy "Users can insert their own collection"
  on public.tcg_collections
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own collection" on public.tcg_collections;
create policy "Users can update their own collection"
  on public.tcg_collections
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own collection" on public.tcg_collections;
create policy "Users can delete their own collection"
  on public.tcg_collections
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_tcg_collection(
  p_data jsonb,
  p_base_revision bigint,
  p_client_id uuid
)
returns table (saved boolean, revision bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select collection_row.revision
    into v_revision
    from public.tcg_collections as collection_row
    where collection_row.user_id = auth.uid()
    for update;

  if not found then
    if p_base_revision <> 0 then
      return query select false, 0::bigint;
      return;
    end if;

    insert into public.tcg_collections (user_id, data, revision, client_id)
    values (auth.uid(), p_data, 1, p_client_id);

    return query select true, 1::bigint;
    return;
  end if;

  if v_revision <> p_base_revision then
    return query select false, v_revision;
    return;
  end if;

  update public.tcg_collections as collection_row
    set data = p_data,
        revision = collection_row.revision + 1,
        client_id = p_client_id,
        updated_at = now()
    where collection_row.user_id = auth.uid();

  return query select true, v_revision + 1;
end;
$$;

revoke all on function public.save_tcg_collection(jsonb, bigint, uuid) from public;
grant execute on function public.save_tcg_collection(jsonb, bigint, uuid) to authenticated;
