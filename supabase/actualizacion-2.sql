alter table public.funciones add column if not exists traslado text;
alter table public.funciones add column if not exists hotel text;
alter table public.funciones add column if not exists prueba_sonido time;
alter table public.funciones add column if not exists checklist jsonb;
alter table public.funciones add column if not exists entradas_vendidas integer;
alter table public.funciones drop constraint if exists funciones_entradas_ok;
alter table public.funciones add constraint funciones_entradas_ok check (entradas_vendidas is null or entradas_vendidas >= 0);
alter table public.teatros add column if not exists catering text;
alter table public.teatros add column if not exists catering_notas text;
alter table public.teatros drop constraint if exists teatros_catering_ok;
alter table public.teatros add constraint teatros_catering_ok check (catering is null or catering in ('teatro', 'llevar'));
update public.teatros t
set latitud = c.lat, longitud = c.lng
from (values
  ('Buenos Aires', 'Ciudad de Buenos Aires', -34.6037, -58.3816),
  ('La Plata', 'Buenos Aires', -34.9214, -57.9545),
  ('Mar del Plata', 'Buenos Aires', -38.0055, -57.5426),
  ('Bahía Blanca', 'Buenos Aires', -38.7196, -62.2724),
  ('San Nicolás de los Arroyos', 'Buenos Aires', -33.3342, -60.2108),
  ('Olavarría', 'Buenos Aires', -36.8927, -60.3225),
  ('Córdoba', 'Córdoba', -31.4201, -64.1888),
  ('Villa Carlos Paz', 'Córdoba', -31.4241, -64.4978),
  ('Río Cuarto', 'Córdoba', -33.1232, -64.3493),
  ('Villa María', 'Córdoba', -32.4075, -63.2402),
  ('Rosario', 'Santa Fe', -32.9442, -60.6505),
  ('Santa Fe', 'Santa Fe', -31.6333, -60.7000),
  ('Rafaela', 'Santa Fe', -31.2503, -61.4867),
  ('Mendoza', 'Mendoza', -32.8895, -68.8458),
  ('Godoy Cruz', 'Mendoza', -32.9287, -68.8448),
  ('San Miguel de Tucumán', 'Tucumán', -26.8083, -65.2176),
  ('Salta', 'Salta', -24.7821, -65.4232),
  ('San Salvador de Jujuy', 'Jujuy', -24.1858, -65.2995),
  ('Santiago del Estero', 'Santiago del Estero', -27.7951, -64.2615),
  ('San Fernando del Valle de Catamarca', 'Catamarca', -28.4696, -65.7852),
  ('San Juan', 'San Juan', -31.5375, -68.5364),
  ('San Luis', 'San Luis', -33.2950, -66.3356),
  ('Resistencia', 'Chaco', -27.4512, -58.9866),
  ('Corrientes', 'Corrientes', -27.4692, -58.8306),
  ('Posadas', 'Misiones', -27.3621, -55.9009),
  ('Paraná', 'Entre Ríos', -31.7319, -60.5238),
  ('Gualeguaychú', 'Entre Ríos', -33.0094, -58.5172),
  ('Santa Rosa', 'La Pampa', -36.6167, -64.2833),
  ('Neuquén', 'Neuquén', -38.9516, -68.0591),
  ('Trelew', 'Chubut', -43.2489, -65.3051)
) as c(ciudad, provincia, lat, lng)
where t.ciudad = c.ciudad and t.provincia = c.provincia and t.latitud is null;
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;
drop policy if exists "documentos leer" on storage.objects;
drop policy if exists "documentos subir" on storage.objects;
drop policy if exists "documentos cambiar" on storage.objects;
drop policy if exists "documentos borrar" on storage.objects;
create policy "documentos leer" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');
create policy "documentos subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos' and public.es_admin());
create policy "documentos cambiar" on storage.objects
  for update to authenticated using (bucket_id = 'documentos' and public.es_admin());
create policy "documentos borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos' and public.es_admin());
