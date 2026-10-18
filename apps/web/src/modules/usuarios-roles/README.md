# Módulo: Usuarios y roles

Altas, aprobación, roles y estado de las cuentas del sistema (ruta `/usuarios`,
grupo **Administración**). El acceso se controla **por función**: los módulos sin
permiso quedan ocultos en el menú y responden **403** en la API aunque se llamen
directamente. Nadie elige su propio rol: lo asigna un Administrador. Hoy consume
**datos de ejemplo (mock determinista)**.

## Estructura

```
modules/usuarios-roles/
├─ UsuariosPage.tsx                 # Página: encabezado, aviso, KPIs, gráfico, filtros y pie
├─ types.ts                         # Tipos del módulo (reexporta los de @/types)
├─ kpis.ts                          # Los 4 indicadores clicables y las secciones ampliables
├─ schemas/
│  └─ usuarios.schema.ts            # Opciones, etiquetas/colores, matriz de permisos y URL ⇄ estado
├─ services/
│  └─ usuarios.service.ts           # Acceso a datos (mock), acciones y exportación por partes
├─ hooks/
│  └─ useUsuariosURL.ts             # Filtros/paginación en la URL
└─ components/
   ├─ AvisoRoles.tsx                # Aviso fijo: acceso por función, 403, auditoría
   ├─ TarjetasUsuarios.tsx          # 4 KPIs clicables (abren su lista)
   ├─ GraficoUsuariosPorRol.tsx     # Barras por rol (clic = usuarios de ese rol)
   ├─ MatrizPermisos.tsx            # Matriz módulo × rol (ver / operar / sin acceso)
   ├─ FiltrosUsuarios.tsx           # Búsqueda, estado, rol, último acceso y orden
   ├─ TablaUsuarios.tsx             # Tabla principal + paginación
   ├─ UsuarioModal.tsx              # Vista ampliada con pestañas Datos / Roles / Actividad
   ├─ ModalAccion.tsx               # Confirmación de aprobar/cambiar rol/suspender/reactivar
   ├─ ModalListaUsuarios.tsx        # Lista de un KPI o de un rol
   ├─ ModalExportar.tsx             # Exportación por partes en CSV o Excel
   ├─ SelectorFilas.tsx             # Filas por página (5/10/25) en la barra de filtros
   └─ Paginador.tsx                 # Barra de paginación (rango y Anterior/Siguiente)
```

## KPIs, gráfico y matriz

- **KPIs clicables**: usuarios totales, **pendientes de aprobación**, activos y
  con MFA. Cada tarjeta abre un modal con la lista de cuentas que representa.
- **Usuarios por rol**: barras horizontales ordenadas; al pulsar una barra se
  abre la lista de usuarios de ese rol. El botón *Ver matriz de permisos* abre la
  matriz módulo × rol (nivel **ver / operar / sin acceso**) resaltando lo que
  puede hacer cada rol.
- Los colores semáforo (verde/ámbar/gris) se usan **solo** para el estado
  administrativo de la cuenta, nunca para eventos sísmicos.

## Modal de usuario (vista ampliada)

Al pulsar una fila se abre la ficha con tres pestañas:

| Pestaña             | Contenido                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `Datos`             | Nombre, correo, roles, estado, MFA, último acceso, alta y aprobación      |
| `Roles y permisos`  | Rol(es) actual(es) y la **matriz de permisos** resaltando su rol          |
| `Actividad reciente`| Últimas acciones (sin secretos), con IP y resultado (ok / fallido)        |

Las acciones (**aprobar**, **cambiar rol**, **suspender**, **reactivar**) solo
aparecen para un Administrador y piden confirmación; cada confirmación avisa que
**se registrará en Auditoría** con antes/después. El sistema **no permite dejar
sin Administrador**: si se intenta, la API responde **409**.

## Filtros, orden y estado en la URL

La página es compartible: filtros y paginación viven en la URL.

| Parámetro | Valores                                                        |
| --------- | -------------------------------------------------------------- |
| `estado`  | `activo` · `pendiente` · `suspendido`                          |
| `rol`     | `admin` · `analyst` · `alert_operator` · `auditor` · `viewer`  |
| `q`       | búsqueda por nombre o correo                                   |
| `acceso`  | `7d` · `30d` · `nunca`                                          |
| `orden`   | `recientes` · `antiguos`                                        |
| `pag`     | entero ≥ 1                                                     |
| `tam`     | `5` · `10` · `25`                                              |

Ejemplo: `/usuarios?estado=pendiente&orden=antiguos&tam=25`

## Roles y permisos

| Acción                         | Permiso    | Roles                         |
| ------------------------------ | ---------- | ----------------------------- |
| Ver el módulo y exportar       | `usuarios` | Administrador, **Auditor**    |
| Aprobar / cambiar rol / suspender / reactivar | Administrador (rol) | Administrador |

El bloqueo por rol es de interfaz; **la API real debe validarlo también**. En
modo desarrollo aparece un **selector de rol** en la barra superior para probar
los permisos sin cambiar de cuenta.

## Exportación por partes

El botón *Exportar* abre un diálogo para elegir bloques y formato. **CSV** genera
un archivo con los bloques seleccionados; **Excel (.xlsx)** genera una hoja por
parte (sin dependencias, ver `src/lib/xlsx.ts`). Partes: Resumen (indicadores),
Usuarios, Usuarios por rol, Matriz de permisos y Actividad reciente. La
exportación **no incluye contraseñas ni tokens**.

## Datos reales de la API

Toda la lectura y escritura pasa por `services/usuarios.service.ts`, que llama a
la API real. Contratos:

```
GET   /api/v1/users?estado&rol&q&acceso&orden&pag&tam  → página de cuentas
POST  /api/v1/users                                    → alta (Administrador)
GET   /api/v1/users/{id}                               → cuenta
PATCH /api/v1/users/{id}                               → editar
POST  /api/v1/users/{id}/approve                       → aprobar + asignar rol
POST  /api/v1/users/{id}/suspend                       → suspender
POST  /api/v1/users/{id}/reactivate                    → reactivar
GET   /api/v1/users/{id}/activity                       → actividad reciente
GET   /api/v1/roles                                    → catálogo de roles
```

La respuesta paginada debe tener la forma `{ filas, total, pagina, tamano,
totalPaginas }` (ver `PaginaUsuarios` en `types.ts`). Toda escritura llama a
`registrar_auditoria()` en el backend con valores antes/después.

## Seguridad y zona horaria

- Mensaje de login **genérico** ("Credenciales inválidas"); pendiente/suspendido
  dan un mensaje claro. Los intentos fallidos se registran en Auditoría.
- Las horas se muestran en **UTC-5** (Perú).
