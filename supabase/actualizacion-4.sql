create table if not exists public.finanzas (
  funcion_id uuid primary key references public.funciones(id) on delete cascade,
  recaudacion numeric(14,2) check (recaudacion is null or recaudacion >= 0),
  gastos numeric(14,2) check (gastos is null or gastos >= 0),
  notas text,
  actualizado_en timestamptz not null default now()
);
drop trigger if exists finanzas_actualizado on public.finanzas;
create trigger finanzas_actualizado before update on public.finanzas
  for each row execute function public.marcar_actualizado();
alter table public.finanzas enable row level security;
revoke all on public.finanzas from anon;
grant select, insert, update, delete on public.finanzas to authenticated;
drop policy if exists "finanzas solo admin" on public.finanzas;
create policy "finanzas solo admin" on public.finanzas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'finanzas') then
    alter publication supabase_realtime add table public.finanzas;
  end if;
end $$;
