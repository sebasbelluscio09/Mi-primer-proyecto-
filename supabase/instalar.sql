create table if not exists public.admins (
  email text primary key
);
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
create table if not exists public.teatros (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  ciudad            text not null,
  provincia         text not null,
  direccion         text,
  capacidad         integer check (capacidad is null or capacidad >= 0),
  contacto_nombre   text,
  contacto_telefono text,
  contacto_email    text,
  notas             text,
  a_verificar       boolean not null default true,
  latitud           double precision,
  longitud          double precision,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create table if not exists public.funciones (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null,
  hora           time,
  teatro_id      uuid references public.teatros(id) on delete set null,
  ciudad         text not null,
  estado         text not null default 'opcion'
                 check (estado in ('opcion', 'confirmada', 'cancelada', 'realizada')),
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists funciones_fecha_idx  on public.funciones (fecha);
create index if not exists funciones_teatro_idx on public.funciones (teatro_id);
create or replace function public.marcar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;
drop trigger if exists teatros_actualizado on public.teatros;
create trigger teatros_actualizado before update on public.teatros
  for each row execute function public.marcar_actualizado();
drop trigger if exists funciones_actualizado on public.funciones;
create trigger funciones_actualizado before update on public.funciones
  for each row execute function public.marcar_actualizado();
alter table public.admins    enable row level security;
alter table public.teatros   enable row level security;
alter table public.funciones enable row level security;
revoke all on public.admins, public.teatros, public.funciones from anon;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.teatros, public.funciones to authenticated;
grant execute on function public.es_admin() to authenticated;
drop policy if exists "leer admins" on public.admins;
create policy "leer admins" on public.admins
  for select to authenticated using (true);
drop policy if exists "leer teatros"     on public.teatros;
drop policy if exists "admin crea teatros"    on public.teatros;
drop policy if exists "admin edita teatros"   on public.teatros;
drop policy if exists "admin borra teatros"   on public.teatros;
create policy "leer teatros" on public.teatros
  for select to authenticated using (true);
create policy "admin crea teatros" on public.teatros
  for insert to authenticated with check (public.es_admin());
create policy "admin edita teatros" on public.teatros
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin borra teatros" on public.teatros
  for delete to authenticated using (public.es_admin());
drop policy if exists "leer funciones"        on public.funciones;
drop policy if exists "admin crea funciones"  on public.funciones;
drop policy if exists "admin edita funciones" on public.funciones;
drop policy if exists "admin borra funciones" on public.funciones;
create policy "leer funciones" on public.funciones
  for select to authenticated using (true);
create policy "admin crea funciones" on public.funciones
  for insert to authenticated with check (public.es_admin());
create policy "admin edita funciones" on public.funciones
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin borra funciones" on public.funciones
  for delete to authenticated using (public.es_admin());
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'teatros') then
    alter publication supabase_realtime add table public.teatros;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'funciones') then
    alter publication supabase_realtime add table public.funciones;
  end if;
end $$;
insert into public.teatros (nombre, ciudad, provincia, direccion, capacidad, notas, a_verificar)
select v.nombre, v.ciudad, v.provincia, v.direccion, v.capacidad,
       'Carga inicial: capacidad aproximada y dirección a confirmar. Falta cargar contacto.',
       true
from (values
  ('Teatro Gran Rex', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 857', 3260),
  ('Teatro Ópera', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 860', 2000),
  ('Teatro Coliseo', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Marcelo T. de Alvear 1125', 1700),
  ('Teatro Gran Rivadavia', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Rivadavia 8636', 1500),
  ('Teatro Lola Membrives', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 1280', 1300),
  ('Teatro Avenida', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. de Mayo 1222', 1200),
  ('Teatro El Nacional', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 960', 1100),
  ('Teatro San Martín - Sala Martín Coronado', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 1530', 1050),
  ('Teatro Astral', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 1639', 1000),
  ('Teatro Broadway', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 1155', 1000),
  ('Teatro Metropolitan - Sala 1', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 1343', 900),
  ('Teatro Apolo', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 1372', 900),
  ('Teatro Maipo', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Esmeralda 443', 700),
  ('Teatro Liceo', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Rivadavia 1499', 700),
  ('Teatro Multitabaris', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Corrientes 831', 600),
  ('Estadio Luna Park', 'Buenos Aires', 'Ciudad de Buenos Aires', 'Av. Eduardo Madero 470', 8400),
  ('Teatro Argentino - Sala Alberto Ginastera', 'La Plata', 'Buenos Aires', 'Av. 51 entre 9 y 10', 2000),
  ('Teatro Municipal Coliseo Podestá', 'La Plata', 'Buenos Aires', 'Calle 10 entre 46 y 47', 700),
  ('Teatro Radio City', 'Mar del Plata', 'Buenos Aires', 'San Luis 1750', 1400),
  ('Teatro Auditorium - Sala Astor Piazzolla', 'Mar del Plata', 'Buenos Aires', 'Bv. Marítimo 2280', 800),
  ('Teatro Colón de Mar del Plata', 'Mar del Plata', 'Buenos Aires', 'Hipólito Yrigoyen 1665', 800),
  ('Teatro Tronador', 'Mar del Plata', 'Buenos Aires', 'Santiago del Estero 1746', 700),
  ('Teatro Municipal de Bahía Blanca', 'Bahía Blanca', 'Buenos Aires', 'Alsina 425', 800),
  ('Teatro Municipal Rafael de Aguiar', 'San Nicolás de los Arroyos', 'Buenos Aires', null, 700),
  ('Teatro Municipal de Olavarría', 'Olavarría', 'Buenos Aires', null, 700),
  ('Teatro del Libertador General San Martín', 'Córdoba', 'Córdoba', 'Av. Vélez Sarsfield 365', 1000),
  ('Quality Teatro', 'Córdoba', 'Córdoba', 'Av. Cruz Roja Argentina 200', 1500),
  ('Teatro Real - Sala Mayor', 'Córdoba', 'Córdoba', 'San Jerónimo 66', 650),
  ('Teatro Luxor', 'Villa Carlos Paz', 'Córdoba', null, 900),
  ('Teatro del Lago', 'Villa Carlos Paz', 'Córdoba', null, 800),
  ('Teatro Municipal de Río Cuarto', 'Río Cuarto', 'Córdoba', null, 900),
  ('Teatro Verdi', 'Villa María', 'Córdoba', null, 800),
  ('Teatro El Círculo', 'Rosario', 'Santa Fe', 'Laprida 1223', 1300),
  ('Teatro Broadway Rosario', 'Rosario', 'Santa Fe', 'San Lorenzo 1223', 1000),
  ('Teatro La Comedia', 'Rosario', 'Santa Fe', 'Mitre y Cortada Ricardone', 600),
  ('Teatro Municipal 1° de Mayo', 'Santa Fe', 'Santa Fe', 'San Martín 2020', 700),
  ('Teatro Lasserre', 'Rafaela', 'Santa Fe', null, 600),
  ('Teatro Independencia', 'Mendoza', 'Mendoza', 'Chile y Espejo', 800),
  ('Teatro Plaza', 'Godoy Cruz', 'Mendoza', 'Colón 27', 900),
  ('Teatro Mendoza', 'Mendoza', 'Mendoza', 'San Juan 1427', 600),
  ('Teatro Mercedes Sosa', 'San Miguel de Tucumán', 'Tucumán', 'San Martín 479', 1200),
  ('Teatro San Martín', 'San Miguel de Tucumán', 'Tucumán', 'Av. Sarmiento 601', 900),
  ('Teatro Provincial Juan Carlos Saravia', 'Salta', 'Salta', 'Zuviría 70', 800),
  ('Teatro Mitre', 'San Salvador de Jujuy', 'Jujuy', 'Alvear 1009', 600),
  ('Teatro 25 de Mayo', 'Santiago del Estero', 'Santiago del Estero', null, 800),
  ('Cine Teatro Catamarca', 'San Fernando del Valle de Catamarca', 'Catamarca', null, 900),
  ('Teatro del Bicentenario', 'San Juan', 'San Juan', null, 1200),
  ('Auditorio Juan Victoria', 'San Juan', 'San Juan', null, 1000),
  ('Cine Teatro San Luis', 'San Luis', 'San Luis', null, 700),
  ('Centro Cultural Guido Miranda', 'Resistencia', 'Chaco', null, 600),
  ('Teatro Oficial Juan de Vera', 'Corrientes', 'Corrientes', 'San Juan 637', 600),
  ('Auditorio del Centro del Conocimiento', 'Posadas', 'Misiones', null, 1000),
  ('Teatro 3 de Febrero', 'Paraná', 'Entre Ríos', '25 de Mayo 60', 600),
  ('Teatro Gualeguaychú', 'Gualeguaychú', 'Entre Ríos', null, 700),
  ('Teatro Español', 'Santa Rosa', 'La Pampa', 'Hilario Lagos 44', 600),
  ('Cine Teatro Español', 'Neuquén', 'Neuquén', 'Av. Argentina 235', 900),
  ('Teatro Español de Trelew', 'Trelew', 'Chubut', null, 600)
) as v(nombre, ciudad, provincia, direccion, capacidad)
where not exists (select 1 from public.teatros);
