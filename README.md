# Agenda de Gira

App web (pensada para el celular) para organizar las giras nacionales de un espectáculo:

- **Calendario de funciones** con vista mensual y vista lista, y estados *Opción / Confirmada / Cancelada / Realizada*.
- **Base de teatros** de Argentina (600+ localidades) con dirección, capacidad, contacto y notas.
- **Usuarios:** administrador (edita todo) y equipo (solo lectura).
- **Tiempo real:** los cambios se ven al instante en todos los celulares.
- **Avisos de conflicto:** dos funciones el mismo día o ciudades a más de 600 km en días seguidos.
- **Mapa de la gira** con el recorrido y los kilómetros entre ciudades.
- **Por función:** logística (traslado, hotel, prueba de sonido), checklist técnico, entradas vendidas vs. capacidad y documentos adjuntos.
- **Historial por teatro:** cuántas veces fuimos y cuánta gente vino.
- **Exportar** a Google Calendar / iPhone y **compartir por WhatsApp**.

Hecha con HTML/CSS/JavaScript, sin compilación. Publicada en GitHub Pages con base de datos en Supabase (plan gratuito).

👉 **Instalación paso a paso:** ver [GUIA.md](GUIA.md).

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | Página principal |
| `js/app.js` | Toda la lógica de la app |
| `js/config.js` | Dirección y clave pública de Supabase |
| `css/styles.css` | Estilos |
| `supabase/instalacion.sql` | Tablas, permisos y carga inicial de teatros (con comentarios) |
| `supabase/instalar.sql` | Lo mismo, sin comentarios (para pegar desde el celular) |
| `supabase/actualizacion-2.sql` | Actualización para los extras (versión 2) |
