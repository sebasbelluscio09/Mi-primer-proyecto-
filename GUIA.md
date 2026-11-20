# Guía de instalación — Agenda de Gira

Tiempo total: unos 15 minutos. No hace falta saber programar.

---

## Paso 1 · Crear la base de datos en Supabase

1. Entrá a **https://supabase.com** y tocá **Start your project**. Registrate con tu cuenta de GitHub (es lo más fácil).
2. Tocá **New project**:
   - **Name:** `agenda-gira`
   - **Database Password:** tocá *Generate a password* y guardala en un lugar seguro (no la vas a necesitar seguido).
   - **Region:** elegí **São Paulo** (la más cercana a Argentina).
   - Tocá **Create new project** y esperá 1–2 minutos.

## Paso 2 · Crear las tablas y cargar los teatros

1. En el menú de la izquierda entrá a **SQL Editor** (ícono de terminal `>_`).
2. Tocá **New query** (o el **+**).
3. Abrí el archivo [`supabase/instalar.sql`](supabase/instalar.sql) (misma instalación, sin comentarios: más segura para pegar desde el celular) de este repositorio, tocá el botón de **copiar** (arriba a la derecha del archivo) y pegalo en Supabase.
4. Tocá **Run** (abajo a la derecha). Si aparece un aviso sobre "operaciones destructivas", confirmá. Tiene que decir **Success**.
5. Borrá todo lo que hay en el editor, pegá esta línea **cambiando el email por el tuyo**, y tocá **Run**:

   ```sql
   insert into public.admins (email) values ('TU_EMAIL@ejemplo.com');
   ```

   Esto te convierte en administrador.

## Paso 2.6 · Actualización para los extras (versión 2)

Agrega logística, checklist, entradas, ubicaciones para el mapa y el espacio para documentos.

1. Abrí [`supabase/actualizacion-2.sql`](supabase/actualizacion-2.sql) y copiá todo el texto.
2. En Supabase → **SQL Editor** → hoja nueva → pegar → **Run** → **Run query**.
3. Tiene que decir **Success**. Se puede ejecutar más de una vez sin problema.

## Paso 3 · Crear los usuarios (vos y tu equipo)

1. Menú izquierdo → **Authentication** → **Users** → botón **Add user** → **Create new user**.
2. Poné el **email** y una **contraseña provisoria**. Dejá tildado **Auto Confirm User**. Tocá **Create user**.
3. Repetí para vos y para cada persona del equipo.
4. Pasale a cada uno su contraseña provisoria; después la pueden cambiar desde la app (pestaña **Cuenta**).

> Solo vos (el email del paso 2) podés editar. Todos los demás usuarios quedan en modo "solo lectura".

## Paso 4 · Cerrar el registro público (¡importante!)

Así nadie de afuera puede crearse una cuenta.

1. **Authentication** → **Sign In / Providers** (en algunas versiones: *Providers* o *Settings*).
2. Apagá **Allow new users to sign up**.
3. Tocá **Save**.

## Paso 5 · Pasarme los dos datos de conexión

1. Arriba de todo en el proyecto tocá **Connect** (o andá a **Project Settings → API / API Keys**).
2. Copiá:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public key** o **publishable key** (un texto largo)
3. Pasámelos por el chat. **Estos dos datos son públicos, no son contraseñas.**
   ⚠️ Nunca compartas la clave llamada **service_role** o **secret**.

## Paso 6 · Publicar la app en GitHub Pages

1. Entrá a tu repositorio en GitHub → **Settings** (engranaje) → **Pages** (menú izquierdo).
2. En **Source** elegí **Deploy from a branch**.
3. En **Branch** elegí la rama de la app (te digo cuál en el chat) y la carpeta **/ (root)**. Tocá **Save**.
4. Esperá 1–2 minutos y recargá la página: arriba aparece la dirección de tu app.
   > Si GitHub dice que Pages no está disponible, el repositorio tiene que ser **público**: Settings → General → abajo de todo, *Change visibility* → *Public*. Es seguro: los datos están protegidos en Supabase, no en el código.

## Paso 7 · Instalarla en el celular

- **iPhone (Safari):** abrí la dirección → botón **Compartir** → **Agregar a inicio**.
- **Android (Chrome):** abrí la dirección → menú **⋮** → **Agregar a la pantalla principal** / **Instalar app**.

---

## Uso diario

- **Agregar una persona al equipo:** Paso 3.
- **Sacar a alguien:** Authentication → Users → los tres puntitos de esa persona → **Delete user**.
- **Alguien se olvidó la contraseña:** Authentication → Users → la persona → **Reset password** no funciona sin email configurado; lo más simple es borrar el usuario y crearlo de nuevo con otra contraseña provisoria.
- **Sumar otro administrador:** repetí la línea del Paso 2.5 con su email.

## Bueno saber

- **Plan gratuito de Supabase:** si nadie usa la app durante **7 días seguidos**, el proyecto se "pausa". Se reactiva entrando a supabase.com y tocando **Restore project**. Durante una gira activa esto no pasa.
- **Teatros de la carga inicial:** son un punto de partida. Capacidades aproximadas, direcciones a confirmar y sin contactos. Cuando verifiques uno, editalo y destildá **Datos a verificar**.
