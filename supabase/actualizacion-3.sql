alter table public.funciones add column if not exists asistentes integer;
alter table public.funciones add column if not exists invitaciones integer;
alter table public.funciones add column if not exists comentario_cierre text;
alter table public.funciones drop constraint if exists funciones_asistentes_ok;
alter table public.funciones add constraint funciones_asistentes_ok check (asistentes is null or asistentes >= 0);
alter table public.funciones drop constraint if exists funciones_invitaciones_ok;
alter table public.funciones add constraint funciones_invitaciones_ok check (invitaciones is null or invitaciones >= 0);
