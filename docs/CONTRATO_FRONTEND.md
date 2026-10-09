# Contrato para el frontend

Estado verificado el 9 de octubre de 2026. Este documento describe la API **implementada hoy**. [CONTEXTO_PROYECTO.md](CONTEXTO_PROYECTO.md) explica la visión del producto y también contiene funciones futuras; no debe usarse como lista de endpoints disponibles.

## Qué puede construir el frontend ahora

- Inicio y cierre de sesión, renovación del acceso y consulta de la cuenta actual.
- Para `SYSADMIN`: alta y listado de organizaciones, y alta de usuarios. Todavía no hay listado de usuarios.
- Para usuarios de organización: alta y lectura de clientes monitoreados y competidores; alta, lectura y cambio de nombre de temas; alta, lectura, aprobación y baja lógica de consultas.
- Para usuarios de organización con CONSULTAS_CREAR: generación asistida de quince borradores por cliente y consulta de su proceso.
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

| Método y ruta                                                                            | Body                                                   | Éxito                                  | Autorización                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- | --------------------------------------- |
| `POST /api/autenticacion/ingresar`                                                       | `SolicitudIngreso`                                     | `200 RespuestaAcceso` + cookie         | Pública                                 |
| `POST /api/autenticacion/renovar`                                                        | —                                                      | `200 RespuestaAcceso` + cookie rotada  | Cookie + `X-Solicitud-API: 1`           |
| `POST /api/autenticacion/salir`                                                          | —                                                      | `204` + cookie borrada                 | Cookie + `X-Solicitud-API: 1`           |
| `GET /api/autenticacion/actual`                                                          | —                                                      | `200 DatosCuenta`                      | JWT                                     |
| `POST /api/organizaciones`                                                               | `SolicitudCrearOrganizacion`                           | `201 RespuestaOrganizacion`            | Rol `SYSADMIN` + `ORGANIZACIONES_CREAR` |
| `GET /api/organizaciones`                                                                | —                                                      | `200 RespuestaOrganizacion[]`          | Rol `SYSADMIN` + `ORGANIZACIONES_VER`   |
| `POST /api/organizaciones/{organizacionUuid}/usuarios`                                   | `SolicitudCrearUsuario`                                | `201 RespuestaUsuario`                 | Rol `SYSADMIN` + `USUARIOS_CREAR`       |
| `POST /api/clientes-monitoreados`                                                        | `SolicitudCrearClienteMonitoreado`                     | `201 DatosCliente`                     | `CLIENTES_CREAR`                        |
| `GET /api/clientes-monitoreados`                                                         | —                                                      | `200 DatosCliente[]`                   | `CLIENTES_VER`                          |
| `GET /api/clientes-monitoreados/{clienteUuid}`                                           | —                                                      | `200 DatosCliente`                     | `CLIENTES_VER`                          |
| `POST /api/clientes-monitoreados/{clienteUuid}/temas`                                    | `SolicitudTema`                                        | `201 DatosTema`                        | `TEMAS_CREAR`                           |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas`                                     | —                                                      | `200 DatosTema[]`                      | `TEMAS_VER`                             |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}`                          | —                                                      | `200 DatosTema`                        | `TEMAS_VER`                             |
| `PATCH /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}`                        | `SolicitudTema`                                        | `200 DatosTema`                        | `TEMAS_EDITAR`                          |
| `POST /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas`               | Array de `SolicitudCrearConsulta`                      | `201 DatosConsulta[]`                  | `CONSULTAS_CREAR`                       |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/generacion`                     | —                                                      | `202 DatosGeneracionConsultas`         | `CONSULTAS_CREAR`                       |
| `GET /api/clientes-monitoreados/{clienteUuid}/consultas/generacion`                      | —                                                      | `200 DatosGeneracionConsultas` o `204` | `CONSULTAS_VER`                         |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas`                | —                                                      | `200 DatosConsulta[]`                  | `CONSULTAS_VER`                         |
| `GET /api/clientes-monitoreados/{clienteUuid}/consultas/por-tema`                        | —                                                      | `200 DatosTemaConConsultas[]`          | `TEMAS_VER` + `CONSULTAS_VER`           |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas/{consultaUuid}` | —                                                      | `200 DatosConsulta`                    | `CONSULTAS_VER`                         |
| `PATCH /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/tipo`           | `{ "tipoConsulta": "REFERENCIA" \| "DESCUBRIMIENTO" }` | `200 DatosConsulta`                    | `CONSULTAS_CAMBIAR_TIPO`                |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/aprobaciones`                   | Array de UUID                                          | `200 DatosConsulta[]`                  | `CONSULTAS_APROBAR`                     |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/bajas`                          | Array de UUID                                          | `204`                                  | `CONSULTAS_ELIMINAR`                    |

`GET /actuator/health` es público y devuelve el estado técnico de la aplicación; no es una función del producto.

## Organizaciones y usuarios

Solo `SYSADMIN` puede administrar las organizaciones y dar de alta usuarios. Una organización se crea vacía:

```json
{ "nombre": "Agencia Norte" }
```

`POST /api/organizaciones` devuelve `201` con, por ejemplo:

```json
{ "uuid": "11111111-1111-4111-8111-111111111111", "nombre": "Agencia Norte" }
```

`GET /api/organizaciones` devuelve `200` con un array de esos mismos objetos, ordenado por `nombre` y limitado a organizaciones activas:

```json
[
  { "uuid": "11111111-1111-4111-8111-111111111111", "nombre": "Agencia Norte" },
  { "uuid": "22222222-2222-4222-8222-222222222222", "nombre": "Agencia Sur" }
]
```

Si no hay organizaciones activas, devuelve `[]`. Requiere el rol `SYSADMIN` y el permiso `ORGANIZACIONES_VER`; no incluye usuarios ni otros campos.

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

### Vista agrupada por tema

`GET /api/clientes-monitoreados/{clienteUuid}/consultas/por-tema` devuelve todos los temas activos del cliente y sus consultas activas en una sola respuesta. Incluye temas sin consultas con `consultas: []`; si no hay temas, devuelve `[]`. Los temas se ordenan por nombre y las consultas de cada tema, de la más reciente a la más antigua. Cada consulta conserva el formato de `DatosConsulta`.

Requiere `TEMAS_VER` y `CONSULTAS_VER`. Una cuenta de organización solo puede leer sus clientes; `SYSADMIN` puede leerlos globalmente. Un cliente ajeno o inexistente devuelve `404`. Los clientes archivados siguen disponibles para lectura; los temas y consultas dados de baja no aparecen.

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

### Cambio de tipo

`PATCH /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/tipo` recibe `{"tipoConsulta":"REFERENCIA"}` o `{"tipoConsulta":"DESCUBRIMIENTO"}`. Requiere `CONSULTAS_CAMBIAR_TIPO` y devuelve `200` con el `DatosConsulta` actualizado; conserva UUID, texto, tema, prioridad y estado. Solo se puede cambiar una consulta en `BORRADOR`. Se rechazan consultas aprobadas, dadas de baja, ajenas, duplicadas o de un cliente archivado o tema dado de baja.

### Aprobación y baja por lote

Ambos endpoints reciben **directamente un array de UUID** de consultas de cualquier tema del cliente:

```json
["66666666-6666-4666-8666-666666666666"]
```

`POST .../consultas/aprobaciones` solo admite consultas activas en `BORRADOR`, dentro de temas y cliente activos. Devuelve `200` con `DatosConsulta[]` de **las consultas del lote**, en el orden solicitado y con `estadoConsulta: "APROBADA"`. El frontend puede reemplazar por UUID las entradas que ya muestra. El tipo `REFERENCIA` o `DESCUBRIMIENTO` no cambia.

`POST .../consultas/bajas` devuelve `204` sin body. La baja es lógica: la consulta desaparece de las rutas de lectura y libera un lugar del cupo. No hay edición de texto, tipo, prioridad o tema de una consulta; para reemplazarla, darla de baja y crear otra.

En la vista agrupada del frontend, **Rechazar** borradores usa esta baja lógica; no crea un estado adicional para la consulta. Si la selección incluye consultas aprobadas, la acción se presenta como **Dar de baja**. La confirmación explica que dejarán de aparecer y liberarán cupo.

Las dos operaciones validan el lote entero antes de cambiar registros. Un UUID inexistente, inactivo o de otro cliente/organización produce `404` y no cambia ninguna consulta; uno repetido o `null` produce `400`. Aprobar una consulta ya aprobada o perteneciente a un tema dado de baja produce `409`; un cliente `ARCHIVADO` también bloquea estas escrituras con `409`. Los clientes archivados conservan lectura.

### Generación con IA

`POST /api/clientes-monitoreados/{clienteUuid}/consultas/generacion` no recibe body. Requiere `CONSULTAS_CREAR`, cliente `ACTIVO`, ninguna consulta activa y ninguna generación terminada previamente. Si ya existe un proceso pendiente o en ejecución, devuelve `202` con **el mismo** `procesoUuid`; si hubo un fallo, permite iniciar otro. Una generación finalizada impide generar de nuevo, incluso si después se dan de baja sus consultas. La clave de OpenAI ausente devuelve `503` sin iniciar proceso.

La respuesta inicial es:

```json
{
  "procesoUuid": "77777777-7777-4777-8777-777777777777",
  "estado": "PENDIENTE",
  "mensaje": null,
  "advertencia": null,
  "temas": [],
  "consultas": []
}
```

`GET` en la **misma ruta** busca el último proceso del cliente en el servidor: no se guarda su UUID en localStorage. Devuelve `204` si el cliente existe pero nunca tuvo un proceso. Si lo hay, devuelve `200` con `PENDIENTE`, `PROCESANDO`, `FINALIZADO` o `FALLIDO`. `CONSULTAS_VER` permite a SYSADMIN consultar el estado globalmente; las cuentas de organización solo ven clientes propios.

Al terminar, `estado` es `FINALIZADO` y `temas` contiene objetos `DatosTema`, mientras `consultas` contiene objetos `DatosConsulta`, todos en `BORRADOR`. Los UUID de tema permiten agruparlos en el front. Si no se pudo leer la portada, `advertencia` informa que se usaron los datos guardados. En `FALLIDO`, `mensaje` explica que se puede reintentar y ambos arrays están vacíos. Un proceso interrumpido por reinicio o vencimiento pasa a `FALLIDO`; no queda pendiente indefinidamente.

**Regla para la página del cliente:** al abrirla, pedir en paralelo `GET /api/clientes-monitoreados/{clienteUuid}` y el `GET` de generación. Mostrar solo un estado de carga hasta que **ambas solicitudes terminen**; no mostrar datos parciales del cliente ni del proceso. Un `204` del proceso cuenta como solicitud terminada. Si falla cualquiera de las dos, mostrar el error correspondiente sin presentar contenido parcial. Después de la carga inicial, consultar únicamente el estado del proceso cada 3 segundos mientras sea `PENDIENTE` o `PROCESANDO` y la página esté abierta; detener el polling al llegar a `FINALIZADO` o `FALLIDO`. Al volver a la página, repetir las dos solicitudes iniciales.

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
- Editar una consulta existente.
- Ejecutar consultas contra proveedores, programar monitoreos, consultar resultados, métricas, reportes o recomendaciones.

Estas funciones aparecen en la visión del producto, pero el frontend aún no puede conectarlas a una API existente. Para ampliar el contrato, actualizar este documento cuando se implemente cada función. La colección [consultas.postman_collection.json](consultas.postman_collection.json) permite probar las siete rutas actuales de consultas.
