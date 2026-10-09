# Contrato para el frontend

Estado verificado el 9 de octubre de 2026. Este documento describe la API **implementada hoy**. [CONTEXTO_PROYECTO.md](CONTEXTO_PROYECTO.md) explica la visión del producto y también contiene funciones futuras; no debe usarse como lista de endpoints disponibles.

## Qué puede construir el frontend ahora

- Inicio y cierre de sesión, renovación del acceso y consulta de la cuenta actual.
- Para `SYSADMIN`: alta y listado de organizaciones activas, y alta de usuarios. Todavía no hay listado de usuarios.
- Para usuarios de organización: alta y lectura de clientes monitoreados y competidores; alta, lectura y cambio de nombre de temas; alta, lectura, aprobación y baja lógica de consultas.
- Para `SYSADMIN`: lectura global de clientes, temas y consultas. Sus permisos actuales no habilitan escribir esos recursos.

El backend distingue cuentas `PLATAFORMA` (SYSADMIN, sin organización) y `ORGANIZACION` (una sola organización). Los roles iniciales son `SYSADMIN`, `PROPIETARIO` y `MIEMBRO`. Un usuario también puede recibir permisos directamente. Para mostrar u ocultar acciones, consultar `GET /api/autenticacion/actual` y usar su array `permisos`; la API vuelve a comprobar permisos y pertenencia en cada petición.

## Convenciones HTTP y sesión

- La base local de la API es `http://localhost:8080`. Todas las rutas de negocio empiezan con `/api`. El backend dockerizado publica el puerto solo en localhost; aún no hay frontend ni proxy incluidos en Compose.
- Enviar `Content-Type: application/json` cuando hay body. Salvo ingreso, renovación y salida, enviar `Authorization: Bearer <tokenAcceso>`.
- `POST /api/autenticacion/ingresar` devuelve un JWT de acceso de 15 minutos en `tokenAcceso` y establece una cookie `token_renovacion` de 7 días. La cookie es HttpOnly, `SameSite=Strict` y solo corresponde a `/api/autenticacion`; JavaScript no puede leerla. Sale con `Secure` cuando la petición llega por HTTPS.
- `POST /api/autenticacion/renovar` y `POST /api/autenticacion/salir` requieren `X-Solicitud-API: 1` y la cookie de renovación. Renovar rota la cookie y devuelve un nuevo JWT. Salir revoca la sesión y borra la cookie.
- Para el frontend, conviene mantener el JWT de acceso en memoria. Al recibir `401` por acceso vencido, puede intentar una renovación y repetir la petición una sola vez; si falla, volver al ingreso. Esta es una recomendación de cliente, no un endpoint adicional.
- Para desarrollo, un proxy del servidor de Vite desde `/api` hacia `http://localhost:8080` permite llamar rutas relativas desde el navegador. En producción recomendamos servir frontend y API bajo un mismo origen. Si se eligen orígenes distintos, habrá que configurar CORS y el envío de credenciales antes de usar la cookie.

### Inicio de sesión

`POST /api/autenticacion/ingresar` acepta el correo del usuario de organización o el identificador de la cuenta de plataforma:

```json
{ "usuario": "ana@ejemplo.com", "clave": "clave-elegida" }
```

Respuesta `200`:

```json
{ "tokenAcceso": "<jwt>", "tipoToken": "Bearer", "expiraEn": "2026-10-09T15:30:00Z" }
```

`expiraEn` es un instante UTC; el valor mostrado es ilustrativo. La cookie se recibe mediante `Set-Cookie`, fuera del JSON. Credenciales ausentes o vacías dan `400`; credenciales completas incorrectas, `401`.

`GET /api/autenticacion/actual` devuelve `200` con la identidad y sus autorizaciones vigentes:

```json
{
  "usuario": "ana@ejemplo.com",
  "tipoCuenta": "ORGANIZACION",
  "organizacionUuid": "11111111-1111-4111-8111-111111111111",
  "roles": ["PROPIETARIO"],
  "permisos": ["CLIENTES_CREAR", "CLIENTES_VER", "TEMAS_VER", "CONSULTAS_VER"]
}
```

El array de permisos es ilustrativo, no una lista exhaustiva. Para una cuenta de plataforma, `tipoCuenta` es `PLATAFORMA` y `organizacionUuid` es `null`.

## Endpoints disponibles

`{clienteUuid}`, `{temaUuid}`, `{consultaUuid}` y `{organizacionUuid}` son UUID públicos obtenidos de respuestas anteriores. `—` significa que no se envía body.

| Método y ruta                                                                            | Body                               | Éxito                                 | Autorización                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------- | --------------------------------------- |
| `POST /api/autenticacion/ingresar`                                                       | `SolicitudIngreso`                 | `200 RespuestaAcceso` + cookie        | Pública                                 |
| `POST /api/autenticacion/renovar`                                                        | —                                  | `200 RespuestaAcceso` + cookie rotada | Cookie + `X-Solicitud-API: 1`           |
| `POST /api/autenticacion/salir`                                                          | —                                  | `204` + cookie borrada                | Cookie + `X-Solicitud-API: 1`           |
| `GET /api/autenticacion/actual`                                                          | —                                  | `200 DatosCuenta`                     | JWT                                     |
| `POST /api/organizaciones`                                                               | `SolicitudCrearOrganizacion`       | `201 RespuestaOrganizacion`           | Rol `SYSADMIN` + `ORGANIZACIONES_CREAR` |
| `GET /api/organizaciones`                                                                | —                                  | `200 RespuestaOrganizacion[]`         | Rol `SYSADMIN` + `ORGANIZACIONES_VER`   |
| `POST /api/organizaciones/{organizacionUuid}/usuarios`                                   | `SolicitudCrearUsuario`            | `201 RespuestaUsuario`                | Rol `SYSADMIN` + `USUARIOS_CREAR`       |
| `POST /api/clientes-monitoreados`                                                        | `SolicitudCrearClienteMonitoreado` | `201 DatosCliente`                    | `CLIENTES_CREAR`                        |
| `GET /api/clientes-monitoreados`                                                         | —                                  | `200 DatosCliente[]`                  | `CLIENTES_VER`                          |
| `GET /api/clientes-monitoreados/{clienteUuid}`                                           | —                                  | `200 DatosCliente`                    | `CLIENTES_VER`                          |
| `POST /api/clientes-monitoreados/{clienteUuid}/temas`                                    | `SolicitudTema`                    | `201 DatosTema`                       | `TEMAS_CREAR`                           |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas`                                     | —                                  | `200 DatosTema[]`                     | `TEMAS_VER`                             |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}`                          | —                                  | `200 DatosTema`                       | `TEMAS_VER`                             |
| `PATCH /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}`                        | `SolicitudTema`                    | `200 DatosTema`                       | `TEMAS_EDITAR`                          |
| `POST /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas`               | Array de `SolicitudCrearConsulta`  | `201 DatosConsulta[]`                 | `CONSULTAS_CREAR`                       |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas`                | —                                  | `200 DatosConsulta[]`                 | `CONSULTAS_VER`                         |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas/{consultaUuid}` | —                                  | `200 DatosConsulta`                   | `CONSULTAS_VER`                         |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/aprobaciones`                   | Array de UUID                      | `200 DatosConsulta[]`                 | `CONSULTAS_APROBAR`                     |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/bajas`                          | Array de UUID                      | `204`                                 | `CONSULTAS_ELIMINAR`                    |

`GET /actuator/health` es público y devuelve el estado técnico de la aplicación; no es una función del producto.

## Organizaciones y usuarios

Solo `SYSADMIN` puede hacer estas altas. Una organización se crea vacía:

```json
{ "nombre": "Agencia Norte" }
```

`POST /api/organizaciones` devuelve `201` con, por ejemplo:

```json
{ "uuid": "11111111-1111-4111-8111-111111111111", "nombre": "Agencia Norte" }
```

`GET /api/organizaciones` devuelve `200` con las organizaciones activas, ordenadas por nombre. No recibe body:

```json
[{ "uuid": "11111111-1111-4111-8111-111111111111", "nombre": "Agencia Norte" }]
```

El frontend usa este listado para elegir la organización al crear un usuario.

Para crear su primer usuario:

```json
{ "nombre": "Ana", "correoElectronico": "ana@ejemplo.com", "clave": "clave-elegida" }
```

El primer usuario recibe `PROPIETARIO` automáticamente. Desde el segundo, `rol` es obligatorio y admite `PROPIETARIO` o `MIEMBRO`:

```json
{
  "nombre": "Luis",
  "correoElectronico": "luis@ejemplo.com",
  "clave": "clave-elegida",
  "rol": "MIEMBRO"
}
```

`POST /api/organizaciones/{organizacionUuid}/usuarios` devuelve `201`:

```json
{
  "uuid": "22222222-2222-4222-8222-222222222222",
  "nombre": "Luis",
  "correoElectronico": "luis@ejemplo.com",
  "rol": "MIEMBRO"
}
```

El correo debe tener formato de email y es único en toda la aplicación; uno repetido devuelve `409`. El primer usuario con un rol distinto de `PROPIETARIO` y los siguientes sin un rol válido devuelven `400`. Una organización inexistente o inactiva devuelve `404`. No enviar organización, usuario creador ni datos de auditoría en los bodies cuando provienen de la ruta o del JWT.

## Clientes monitoreados y competidores

`POST /api/clientes-monitoreados` crea un cliente para la organización del JWT. `competidores` puede omitirse o ser un array vacío:

```json
{
  "nombre": "Taller Norte",
  "nombreMarca": "Taller Norte",
  "sitioWeb": "https://tallernorte.example",
  "descripcion": "Servicio automotor",
  "rubro": "Talleres",
  "pais": "AR",
  "idioma": "es-AR",
  "competidores": [{ "nombre": "Taller Sur", "sitioWeb": "https://tallersur.example" }]
}
```

`nombre`, `nombreMarca`, `sitioWeb`, `rubro`, `pais` e `idioma` son obligatorios. El sitio debe ser una URL completa HTTP o HTTPS. `pais` usa dos letras mayúsculas; `idioma` admite códigos como `es-AR`. El sitio de un competidor es opcional.

`POST` devuelve `201` y `GET` devuelve el mismo formato de `DatosCliente`:

```json
{
  "uuid": "33333333-3333-4333-8333-333333333333",
  "organizacionUuid": "11111111-1111-4111-8111-111111111111",
  "nombre": "Taller Norte",
  "nombreMarca": "Taller Norte",
  "sitioWeb": "https://tallernorte.example",
  "descripcion": "Servicio automotor",
  "rubro": "Talleres",
  "pais": "AR",
  "idioma": "es-AR",
  "estado": "ACTIVO",
  "competidores": [
    {
      "uuid": "44444444-4444-4444-8444-444444444444",
      "nombre": "Taller Sur",
      "sitioWeb": "https://tallersur.example"
    }
  ]
}
```

`estado` puede ser `ACTIVO` o `ARCHIVADO`. Los archivados siguen visibles en las rutas de lectura, pero todavía no existe endpoint para archivarlos o reactivarlos. Un usuario de organización solo ve clientes propios; `SYSADMIN` puede leer todos. Un UUID ajeno o inexistente devuelve `404`.

## Temas

`POST` y `PATCH` de temas reciben el mismo body:

```json
{ "nombre": "Gestión de talleres" }
```

`POST` devuelve `201`; `GET` y `PATCH`, `200`. El formato de `DatosTema` es:

```json
{
  "uuid": "55555555-5555-4555-8555-555555555555",
  "clienteUuid": "33333333-3333-4333-8333-333333333333",
  "nombre": "Gestión de talleres"
}
```

El nombre es obligatorio y admite hasta 200 caracteres. No puede haber dos temas activos del mismo cliente con igual nombre, ignorando mayúsculas y espacios exteriores; el conflicto devuelve `409`. Solo se pueden crear o renombrar temas de clientes `ACTIVO`. Los temas de clientes `ARCHIVADO` siguen disponibles para lectura.

## Consultas

### Alta

`POST /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas` recibe **directamente un array JSON**, no un objeto contenedor. Cada elemento requiere `texto` (hasta 2000 caracteres), `tipoConsulta` (`REFERENCIA` o `DESCUBRIMIENTO`) y `prioridad` (`ALTA`, `MEDIA` o `BAJA`):

```json
[
  { "texto": "mejor software para talleres", "tipoConsulta": "REFERENCIA", "prioridad": "ALTA" },
  {
    "texto": "herramientas nuevas para talleres",
    "tipoConsulta": "DESCUBRIMIENTO",
    "prioridad": "MEDIA"
  }
]
```

Devuelve `201` con un array `DatosConsulta[]` en el orden enviado. Cada consulta nueva empieza en `BORRADOR`. Las rutas de lectura usan el mismo formato:

```json
[
  {
    "uuid": "66666666-6666-4666-8666-666666666666",
    "clienteUuid": "33333333-3333-4333-8333-333333333333",
    "temaUuid": "55555555-5555-4555-8555-555555555555",
    "texto": "mejor software para talleres",
    "tipoConsulta": "REFERENCIA",
    "estadoConsulta": "BORRADOR",
    "prioridad": "ALTA"
  }
]
```

El array no puede estar vacío. Un cliente admite **15 consultas activas en total**, sumando todos sus temas; dar de baja libera cupo. Dentro de un tema, una consulta activa no puede repetir texto y tipo de otra, ignorando mayúsculas y espacios exteriores. Si falla un elemento o no alcanza el cupo, no se guarda ninguno. El cliente y el tema deben estar activos.

### Aprobación y baja por lote

Ambos endpoints reciben **directamente un array de UUID** de consultas de cualquier tema del cliente:

```json
["66666666-6666-4666-8666-666666666666"]
```

`POST .../consultas/aprobaciones` solo admite consultas activas en `BORRADOR`, dentro de temas y cliente activos. Devuelve `200` con `DatosConsulta[]` de **las consultas del lote**, en el orden solicitado y con `estadoConsulta: "APROBADA"`. El frontend puede reemplazar por UUID las entradas que ya muestra. El tipo `REFERENCIA` o `DESCUBRIMIENTO` no cambia.

`POST .../consultas/bajas` devuelve `204` sin body. La baja es lógica: la consulta desaparece de las rutas de lectura y libera un lugar del cupo. No hay edición de texto, tipo, prioridad o tema de una consulta; para reemplazarla, darla de baja y crear otra.

Las dos operaciones validan el lote entero antes de cambiar registros. Un UUID inexistente, inactivo o de otro cliente/organización produce `404` y no cambia ninguna consulta; uno repetido o `null` produce `400`. Aprobar una consulta ya aprobada o perteneciente a un tema dado de baja produce `409`; un cliente `ARCHIVADO` también bloquea estas escrituras con `409`. Los clientes archivados conservan lectura.

## Errores y estados para la interfaz

| Estado | Tratamiento recomendado                                                                        |
| ------ | ---------------------------------------------------------------------------------------------- |
| `400`  | Body inválido o regla de entrada incumplida; mostrar el motivo disponible junto al formulario. |
| `401`  | Falta JWT, venció o la sesión ya no es válida; intentar renovar cuando corresponda.            |
| `403`  | La cuenta carece del permiso o rol necesario.                                                  |
| `404`  | Recurso inexistente, inactivo u oculto por pertenecer a otra organización.                     |
| `409`  | Conflicto de estado o unicidad, como duplicados, cupo completo o cliente archivado.            |

En consultas, los errores de validación y negocio usan `application/problem+json` y exponen `status` y `detail`. Ejemplo ilustrativo:

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "No se aprobó ninguna consulta. UUID 2 ya fue aprobada."
}
```

No todas las rutas usan el mismo cuerpo de error: algunas respuestas de autenticación son vacías. El frontend debe tomar el **estado HTTP** como fuente principal y mostrar `detail` solo cuando venga en el JSON. La identidad y la organización no se toman de campos añadidos por el frontend: las determina el backend desde el JWT y la ruta.

## Funciones todavía sin endpoint

- Listar usuarios; editar o eliminar usuarios; cambiar contraseñas.
- Editar clientes o competidores, archivar/reactivar clientes desde la API.
- Dar de baja temas mediante HTTP.
- Editar una consulta existente o generar sugerencias con IA.
- Ejecutar consultas contra proveedores, programar monitoreos, consultar resultados, métricas, reportes o recomendaciones.

Estas funciones aparecen en la visión del producto, pero el frontend aún no puede conectarlas a una API existente. Para ampliar el contrato, actualizar este documento cuando se implemente cada función. La colección [consultas.postman_collection.json](consultas.postman_collection.json) permite probar las cinco rutas actuales de consultas.
