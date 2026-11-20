# Agenda de Gira — contexto para Claude

Leé esto antes de hacer cualquier cosa. Es la memoria del proyecto entre sesiones.

## Quién es el usuario y cómo trabajar con él

- Productor teatral argentino que arma las giras nacionales de un humorista. **No sabe programar.**
- Escribe en español rioplatense (vos). Respondé siempre en español simple, sin jerga técnica.
- Usa casi todo **desde el iPhone** (Safari) y manda **capturas de pantalla**. Guialo paso a paso, de a un paso por mensaje cuando tenga que tocar algo (Supabase, GitHub), con **links directos** a la pantalla exacta.
- Le gusta que le propongas mejoras por iniciativa propia: al terminar algo, sugerí 2-3 ideas concretas (ver "Ideas pendientes") y preguntá cuáles quiere.
- Pedile confirmación antes de cambios grandes o que afecten datos; los cambios chicos de la app hacelos directamente.
- Lo que él ve: la app publicada y Supabase. No le muestres código salvo que lo pida.

## Dónde vive todo

| Qué | Dónde |
|---|---|
| App publicada | https://sebasbelluscio09.github.io/Mi-primer-proyecto-/ |
| Repositorio | github.com/sebasbelluscio09/Mi-primer-proyecto- |
| Rama publicada | `claude/theater-tour-app-mjdit1` (GitHub Pages: "Deploy from a branch", carpeta raíz). `main` NO se usa; pasarla a main es opcional y el usuario no lo pidió. |
| Supabase | proyecto `beobwlamthenaidcixvf` (región São Paulo, plan gratuito). URL y clave *publishable* están en `js/config.js` (son públicas, está bien). |
| Editor SQL (link para el usuario) | https://supabase.com/dashboard/project/beobwlamthenaidcixvf/sql/new |
| Usuarios (link para el usuario) | https://supabase.com/dashboard/project/beobwlamthenaidcixvf/auth/users |
| Archivo "raw" para copiar SQL desde el celular | `https://raw.githubusercontent.com/sebasbelluscio09/Mi-primer-proyecto-/claude/theater-tour-app-mjdit1/supabase/<archivo>.sql` |

Desde el contenedor de Claude **no hay acceso de red a Supabase** (proxy 403): no se puede consultar la base real. Se prueba localmente (ver "Cómo probar").

## Arquitectura

- Sitio estático sin compilación: `index.html`, `css/styles.css`, `js/app.js` (todo el código, vanilla JS en un IIFE), `js/config.js`.
- `@supabase/supabase-js@2.117.3` (UMD desde jsDelivr). Leaflet 1.9.4 desde unpkg (se carga solo al abrir el Mapa). Mapas de OpenStreetMap. Geocodificación con Nominatim (solo al guardar teatros).
- Ingreso con **email + contraseña** (no magic link: el SMTP gratuito de Supabase no manda a externos). El admin crea usuarios en Supabase → Add user → "Auto Confirm User". **Registro público desactivado** ("Allow new users to sign up" apagado).
- Roles: tabla `admins(email)` + función `es_admin()`. Todo usuario logueado lee; solo admin escribe (RLS en todas las tablas).
- **Cache de Safari**: GitHub Pages cachea ~10 min. En cada cambio de CSS/JS **subí el número `?v=N` en `index.html`** (hoy `v=7`).

### Base de datos (Supabase)

Scripts en `supabase/`, ejecutados por el usuario en este orden (todos re-ejecutables):
1. `instalar.sql` (= `instalacion.sql` sin comentarios): `admins`, `teatros`, `funciones`, RLS, realtime, 57 teatros iniciales "a verificar".
2. `actualizacion-2.sql`: funciones.{traslado, hotel, prueba_sonido, checklist jsonb, entradas_vendidas}; teatros.{catering ('teatro'|'llevar'), catering_notas}; coordenadas de los 57 teatros; bucket privado `documentos` + políticas.
3. `actualizacion-3.sql`: funciones.{asistentes, invitaciones, comentario_cierre}.
4. `actualizacion-4.sql`: tabla `finanzas(funcion_id, recaudacion, gastos, notas)` con RLS **solo admin** (el equipo no la puede leer).
5. `actualizacion-5.sql`: funciones.tipo ('teatro'|'privado', default teatro) + datos de evento privado: evento_tipo, cliente, lugar, direccion, provincia, contacto_nombre/telefono/email, latitud/longitud (se geocodifica al guardar).

Reglas para SQL nuevo:
- Archivo nuevo `supabase/actualizacion-N.sql`, **sin comentarios `--`** (al pegarlos desde el iPhone se rompen) e **idempotente** (`if not exists`, `drop policy if exists`, etc.).
- Probalo antes en Postgres local (ver abajo). Agregá el paso en `GUIA.md` y la fila en `README.md`.
- Al usuario: link raw para copiar + link al editor SQL + "Run" → "Run query" (el aviso de "destructive operation" es normal).
- Si la app usa columnas nuevas, el error "column does not exist" ya se traduce a "Falta ejecutar la actualización".

## Funciones que ya existen (no rehacer)

- Calendario mensual y lista, estados Opción / Confirmada / Cancelada / Realizada, filtros.
- Teatros: alta, edición y baja (solo admin), búsqueda, "a verificar", contacto, **catering**, ubicación (auto por ciudad o por dirección), **historial** (veces, promedio, mejor, total).
- Función: logística, checklist técnico (8 ítems base, editable), entradas vs capacidad, documentos adjuntos (Storage), WhatsApp, agendar (Google Calendar / .ics), exportar toda la gira (.ics).
- Avisos: dos funciones el mismo día; ciudades a más de 600 km en días seguidos.
- Mapa con recorrido numerado y km en línea recta.
- **Cierre de función**: aviso de confirmadas ya pasadas → asistentes, vendidas, invitaciones, comentario → pasa a Realizada.
- Al programar en un teatro se muestra cómo fue la última vez.
- Pestaña **Números**: público total, promedio, ocupación, por provincia, por mes, mejores teatros.
- **Recaudación / gastos / neto** solo para el admin (en función, cierre y Números). Nunca va en WhatsApp ni en el .ics.
- **Eventos privados** (empresas, fiestas, festivales, municipios): en el formulario se elige 🎭 Teatro / 🎤 Evento privado; en Calendario hay un tercer botón "🎤 Privados" con su lista y botón "+ Privado". En privados, "Recaudación" se llama **Cachet** (misma tabla `finanzas`), no hay sección Entradas y el cierre no exige asistentes. Se marcan con 🎤 en calendario, tarjetas, WhatsApp y .ics.
- **Recordatorios** (solo admin): funciones de los próximos 7 días con algo pendiente.
- El equipo (no admin) ve calendario, mapa, números y detalle de funciones en modo lectura; no ve Teatros, recaudación ni recordatorios.

## Cómo probar (antes de cada push)

- `node --check js/app.js`.
- Playwright con Supabase falso: interceptar `cdn.jsdelivr.net` y servir un stub de `window.supabase` (from/select/insert/update/upsert/delete, rpc es_admin, storage, auth). Fijar la fecha con un `addInitScript` que reemplace `Date`. Probar como admin y como equipo (`#lector`). Mirar capturas a 390px de ancho.
- SQL: Postgres 16 local (`/usr/lib/postgresql/16/bin`, socket en `/var/tmp/pgt` porque la ruta del scratchpad es muy larga), con stubs de roles `anon`/`authenticated`, `auth.jwt()`, publicación `supabase_realtime` y `storage.buckets/objects`. Correr todos los scripts en orden dos veces y verificar RLS con `set role authenticated; set request.jwt.claims = '{"email":"..."}'`.

## Ideas pendientes (proponerlas cuando venga al caso)

- Notificaciones push / email de recordatorios (hoy solo se ven dentro de la app).
- Suscripción de calendario que se actualice sola (necesitaría una Edge Function de Supabase).
- Contactos por función (productor local, técnico) además del contacto del teatro.
- Presupuesto de gira por tramo (micro, avión, hotel) y comparación con lo recaudado.
- Plantillas de checklist distintas por tipo de sala.
- Funcionar sin conexión (service worker) para teatros con mala señal.
- Exportar estadísticas a planilla (CSV/Excel).
- Verificar los 57 teatros iniciales (capacidades aproximadas, faltan contactos).
- Mantenimiento: si pasan 7 días sin uso, Supabase pausa el proyecto (se reactiva con "Restore project").
