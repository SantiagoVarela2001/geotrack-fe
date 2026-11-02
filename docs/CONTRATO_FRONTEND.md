# Contrato para el frontend

Contrato F02 actualizado al 1 de noviembre de 2026; las demás secciones conservan su documentación previa. Este documento describe la API implementada y los contratos acordados para la edición de consultas en borrador, los cambios de estado, la gestión de competidores, el análisis semanal manual y los gastos estimados de IA. [CONTEXTO_PROYECTO.md](CONTEXTO_PROYECTO.md) explica la visión del producto y también contiene funciones futuras; no debe usarse como lista de endpoints disponibles.

## Qué puede construir el frontend ahora

- Inicio y cierre de sesión, renovación del acceso y consulta de la cuenta actual.
- Para `SYSADMIN` con los permisos correspondientes: lectura de planes, alta y listado de organizaciones, alta, listado, baja y reactivación de usuarios, y gastos estimados de IA por organización.
- Para `PROPIETARIO` con los permisos correspondientes: alta, listado, baja y reactivación de usuarios de su propia organización. Todas las cuentas pueden consultar y actualizar su perfil y cambiar su contraseña.
- Para usuarios de organización: alta, lectura, archivo y reactivación de clientes monitoreados; alta, lectura y baja lógica de competidores; alta, lectura y cambio de nombre de temas; alta, lectura, edición de borradores, aprobación y baja lógica de consultas.
- Para usuarios de organización con CONSULTAS_CREAR: generación asistida de quince borradores por cliente y consulta de su proceso.
- Para usuarios con `CONSULTAS_VER`: lectura de ejecuciones manuales y métricas GEO agregadas por cliente y período.
- Para usuarios con `ANALISIS_SEMANALES_VER`: lectura del último análisis semanal, de cada proceso y del historial paginado. Los usuarios de organización con `ANALISIS_SEMANALES_CREAR` pueden iniciar un análisis manual.
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
{"usuario":"ana@ejemplo.com","clave":"clave-elegida"}
```

Respuesta `200`:

```json
{"tokenAcceso":"<jwt>","tipoToken":"Bearer","expiraEn":"2026-10-09T15:30:00Z"}
```

`expiraEn` es un instante UTC; el valor mostrado es ilustrativo. La cookie se recibe mediante `Set-Cookie`, fuera del JSON. Credenciales ausentes o vacías dan `400`; credenciales completas incorrectas, `401`.

`GET /api/autenticacion/actual` devuelve `200` con la identidad y sus autorizaciones vigentes:

```json
{
  "usuario": "ana@ejemplo.com",
  "tipoCuenta": "ORGANIZACION",
  "organizacionUuid": "11111111-1111-4111-8111-111111111111",
  "nombreOrganizacion": "Agencia Norte",
  "logoUrl": "/api/organizaciones/11111111-1111-4111-8111-111111111111/logo",
  "roles": ["PROPIETARIO"],
  "permisos": ["CLIENTES_CREAR", "CLIENTES_VER", "TEMAS_VER", "CONSULTAS_VER"]
}
```

El array de permisos es ilustrativo, no una lista exhaustiva. Para una cuenta de plataforma, `tipoCuenta` es `PLATAFORMA` y `organizacionUuid`, `nombreOrganizacion` y `logoUrl` son `null`. `logoUrl` también es `null` cuando la organización aún no tiene logo.

## Endpoints disponibles

`{clienteUuid}`, `{temaUuid}`, `{consultaUuid}` y `{organizacionUuid}` son UUID públicos obtenidos de respuestas anteriores. `—` significa que no se envía body.

| Método y ruta | Body | Éxito | Autorización |
| --- | --- | --- | --- |
| `POST /api/autenticacion/ingresar` | `SolicitudIngreso` | `200 RespuestaAcceso` + cookie | Pública |
| `POST /api/autenticacion/renovar` | — | `200 RespuestaAcceso` + cookie rotada | Cookie + `X-Solicitud-API: 1` |
| `POST /api/autenticacion/salir` | — | `204` + cookie borrada | Cookie + `X-Solicitud-API: 1` |
| `GET /api/autenticacion/actual` | — | `200 DatosCuenta` | JWT |
| `GET /api/planes` | — | `200 DatosPlan[]` | Rol `SYSADMIN` + `PLANES_VER` |
| `POST /api/organizaciones` | `SolicitudCrearOrganizacion` | `201 RespuestaOrganizacion` | Rol `SYSADMIN` + `ORGANIZACIONES_CREAR` |
| `GET /api/organizaciones` | — | `200 RespuestaOrganizacion[]` | Rol `SYSADMIN` + `ORGANIZACIONES_VER` |
| `GET /api/organizaciones/{organizacionUuid}/logo` | — | `200 image/png` o `image/jpeg`; `404` si no existe | Pública |
| `PUT /api/organizaciones/{organizacionUuid}/logo` | `multipart/form-data` con campo `archivo` | Logo cargado o reemplazado | Rol `PROPIETARIO` de la organización + `ORGANIZACIONES_LOGO_EDITAR` |
| `GET /api/organizaciones/gastos-ia?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | — | `200 DatosGastoIaOrganizacion[]` | Rol `SYSADMIN` + `GASTOS_IA_VER` |
| `POST /api/organizaciones/{organizacionUuid}/usuarios` | `SolicitudCrearUsuario` | `201 RespuestaUsuario` | Rol `SYSADMIN` o `PROPIETARIO` + `USUARIOS_CREAR` |
| `GET /api/organizaciones/{organizacionUuid}/usuarios` | — | `200 DatosUsuarioOrganizacion[]` | Rol `SYSADMIN` o `PROPIETARIO` + `USUARIOS_VER` |
| `DELETE /api/organizaciones/{organizacionUuid}/usuarios/{usuarioUuid}` | — | `200 DatosUsuarioOrganizacion` | Rol `SYSADMIN` o `PROPIETARIO` + `USUARIOS_ELIMINAR` |
| `PATCH /api/organizaciones/{organizacionUuid}/usuarios/{usuarioUuid}/reactivar` | — | `200 DatosUsuarioOrganizacion` | Rol `SYSADMIN` o `PROPIETARIO` + `USUARIOS_REACTIVAR` |
| `GET /api/usuarios/yo` | — | `200 DatosPerfil` | JWT |
| `PATCH /api/usuarios/yo` | `SolicitudActualizarPerfil` | `200 DatosPerfil` actualizado | JWT |
| `PUT /api/usuarios/yo/clave` | `SolicitudCambiarClave` | `204` | JWT |
| `POST /api/clientes-monitoreados` | `SolicitudCrearClienteMonitoreado` | `201 DatosCliente` | `CLIENTES_CREAR` |
| `GET /api/clientes-monitoreados` | — | `200 DatosCliente[]` | `CLIENTES_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}` | — | `200 DatosCliente` | `CLIENTES_VER` |
| `PATCH /api/clientes-monitoreados/{clienteUuid}/estado` | `{"estado":"ARCHIVADO"}` o `{"estado":"ACTIVO"}` | `200 DatosCliente` actualizado | `CLIENTES_CAMBIAR_ESTADO` |
| `POST /api/clientes-monitoreados/{clienteUuid}/competidores` | `SolicitudCompetidor` | `201 DatosCliente` actualizado | `COMPETIDORES_CREAR` |
| `DELETE /api/clientes-monitoreados/{clienteUuid}/competidores/{competidorUuid}` | — | `200 DatosCliente` actualizado | `COMPETIDORES_ELIMINAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/temas` | `SolicitudTema` | `201 DatosTema` | `TEMAS_CREAR` |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas` | — | `200 DatosTema[]` | `TEMAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}` | — | `200 DatosTema` | `TEMAS_VER` |
| `PATCH /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}` | `SolicitudTema` | `200 DatosTema` | `TEMAS_EDITAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas` | Array de `SolicitudCrearConsulta` | `201 DatosConsulta[]` | `CONSULTAS_CREAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/generacion` | — | `202 DatosGeneracionConsultas` | `CONSULTAS_CREAR` |
| `GET /api/clientes-monitoreados/{clienteUuid}/consultas/generacion` | — | `200 DatosGeneracionConsultas` o `204` | `CONSULTAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/consultas/por-tema` | — | `200 DatosTemaConConsultas[]` | `TEMAS_VER` y `CONSULTAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas` | — | `200 DatosConsulta[]` | `CONSULTAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas/{consultaUuid}` | — | `200 DatosConsulta` | `CONSULTAS_VER` |
| `PATCH /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/tipo` | `SolicitudCambiarTipoConsulta` | `200 DatosConsulta` | `CONSULTAS_CAMBIAR_TIPO` |
| `PATCH /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/marca` | `SolicitudCambiarMarcaConsulta` | `200 DatosConsulta` | `CONSULTAS_EDITAR` |
| `PUT /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}` | `SolicitudEditarConsulta` | `200 DatosConsulta` | `CONSULTAS_EDITAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/aprobaciones` | Array de UUID | `200 DatosConsulta[]` | `CONSULTAS_APROBAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/bajas` | Array de UUID | `204` | `CONSULTAS_ELIMINAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/ejecuciones` | — | `202 DatosEjecucionConsulta` | `CONSULTAS_EJECUTAR` |
| `GET /api/clientes-monitoreados/{clienteUuid}/ejecuciones/{ejecucionUuid}` | — | `200 DatosEjecucionConsulta` | `CONSULTAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/ejecuciones/ultima` | — | `200 DatosEjecucionConsulta` o `204` | `CONSULTAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/metricas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | — | `200 DatosMetricasSeparadasCliente` | `CONSULTAS_VER` |
| `POST /api/clientes-monitoreados/{clienteUuid}/analisis-semanales` | — | `202 DatosAnalisisSemanal` | `ANALISIS_SEMANALES_CREAR` |
| `GET /api/clientes-monitoreados/{clienteUuid}/analisis-semanales/ultimo` | — | `200 DatosAnalisisSemanal` o `204` | `ANALISIS_SEMANALES_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/analisis-semanales/{analisisUuid}` | — | `200 DatosAnalisisSemanal` | `ANALISIS_SEMANALES_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/analisis-semanales?pagina=0` | — | `200 Page<DatosAnalisisSemanal>` | `ANALISIS_SEMANALES_VER` |

`GET /actuator/health` es público y devuelve el estado técnico de la aplicación; no es una función del producto.

## Organizaciones y usuarios

Solo `SYSADMIN` puede administrar las organizaciones. `SYSADMIN` y `PROPIETARIO` con `USUARIOS_CREAR` pueden dar de alta usuarios; el propietario usa exclusivamente su `organizacionUuid` de `GET /api/autenticacion/actual`. El plan es obligatorio al crear una organización vacía:

```json
{"nombre":"Agencia Norte","planUuid":"00000000-0000-4000-8000-000000000201"}
```

El selector de planes consulta `GET /api/planes`, que devuelve los planes activos ordenados por nombre. Requiere `PLANES_VER` y devuelve objetos con `uuid`, `nombre` y `limiteClientesActivos`:

```json
[
  {"uuid":"00000000-0000-4000-8000-000000000201","nombre":"Básico","limiteClientesActivos":5}
]
```

El `uuid` elegido se envía como `planUuid`. Un plan omitido, inválido o inexistente devuelve `400`. El límite corresponde a clientes monitoreados activos de la organización.

`POST /api/organizaciones` devuelve `201` con, por ejemplo:

```json
{"uuid":"11111111-1111-4111-8111-111111111111","nombre":"Agencia Norte","logoUrl":null}
```

`GET /api/organizaciones` devuelve `200` con un array de esos mismos objetos, ordenado por `nombre` y limitado a organizaciones activas:

```json
[
  {"uuid":"11111111-1111-4111-8111-111111111111","nombre":"Agencia Norte","logoUrl":null},
  {"uuid":"22222222-2222-4222-8222-222222222222","nombre":"Agencia Sur","logoUrl":null}
]
```

Si no hay organizaciones activas, devuelve `[]`. Requiere el rol `SYSADMIN` y el permiso `ORGANIZACIONES_VER`; cada fila incluye solo `uuid`, `nombre` y `logoUrl`.

El propietario puede cargar o reemplazar el logo de su propia organización mediante `PUT /api/organizaciones/{organizacionUuid}/logo` con el campo `archivo`. El frontend acepta PNG y JPG de hasta 5 MB. El logo actual se consulta públicamente en `GET /api/organizaciones/{organizacionUuid}/logo`; `logoUrl` vale `null` hasta que exista una imagen.

Para crear su primer usuario:

```json
{"nombre":"Ana","correoElectronico":"ana@ejemplo.com","clave":"clave-elegida"}
```

El primer usuario recibe `PROPIETARIO` automáticamente. Desde el segundo, `rol` es obligatorio y admite `PROPIETARIO` o `MIEMBRO`:

```json
{"nombre":"Luis","correoElectronico":"luis@ejemplo.com","clave":"clave-elegida","rol":"MIEMBRO"}
```

`POST /api/organizaciones/{organizacionUuid}/usuarios` devuelve `201`:

```json
{"uuid":"22222222-2222-4222-8222-222222222222","nombre":"Luis","correoElectronico":"luis@ejemplo.com","rol":"MIEMBRO"}
```

El correo debe tener formato de email y es único en toda la aplicación; uno repetido devuelve `409`. El primer usuario con un rol distinto de `PROPIETARIO` y los siguientes sin un rol válido devuelven `400`. Una organización inexistente o inactiva devuelve `404`. No enviar organización, usuario creador ni datos de auditoría en los bodies cuando provienen de la ruta o del JWT.

`GET /api/organizaciones/{organizacionUuid}/usuarios` devuelve cuentas activas e inactivas, con las activas primero y ordenadas por nombre dentro de cada grupo. `SYSADMIN` puede consultar cualquier organización; `PROPIETARIO` solo la propia. `MIEMBRO` recibe `403` y una organización ajena al propietario devuelve `404`. Cada fila tiene `uuid`, `nombre`, `correoElectronico`, `roles` (array), `activo` y `fechaEliminacion` (fecha o `null`).

`DELETE /api/organizaciones/{organizacionUuid}/usuarios/{usuarioUuid}` no recibe body y devuelve la fila actualizada con `activo: false` y `fechaEliminacion`. La baja es lógica: revoca las sesiones y el acceso de la cuenta, pero conserva su correo reservado. La cuenta debe estar activa y pertenecer a la organización de la ruta; si no, responde `404`. La baja de la cuenta propia o del último propietario activo responde `409` con `detail` legible. La respuesta permite sustituir la fila local sin volver a consultar el listado.

`PATCH /api/organizaciones/{organizacionUuid}/usuarios/{usuarioUuid}/reactivar` no recibe body y devuelve la fila con `activo: true`. Conserva UUID, correo, contraseña, roles, permisos y `fechaEliminacion` como dato histórico de la última baja. El estado actual se determina con `activo`. La persona puede volver a ingresar con su contraseña habitual, pero las sesiones revocadas siguen cerradas. Una cuenta ya activa responde `409`; una cuenta ajena, inexistente o de una organización inactiva responde `404`. Requiere `USUARIOS_REACTIVAR`, además del rol `SYSADMIN` o `PROPIETARIO` de la organización. La respuesta permite actualizar la fila local sin otra consulta.

### Mi perfil y contraseña

`GET /api/usuarios/yo` devuelve `uuid`, `nombre`, `correoElectronico` y `tipoCuenta`. `PATCH /api/usuarios/yo` recibe el nombre y el correo electrónico completos y devuelve el perfil actualizado. Para `SYSADMIN`, enviar solo `nombre`: la cuenta de plataforma no tiene correo y su identificador de ingreso permanece fijo. Después de cambiar el correo, volver a consultar `GET /api/autenticacion/actual` para actualizar el usuario mostrado. La sesión actual sigue vigente.

`PUT /api/usuarios/yo/clave` recibe `{"claveActual":"clave-elegida","claveNueva":"clave-nueva"}` y devuelve `204`. La confirmación de la nueva contraseña se comprueba en el frontend y no se envía. Al cambiar la contraseña se cierran las demás sesiones; la sesión actual permanece abierta. Un `400` puede indicar datos inválidos o contraseña actual incorrecta; `403`, falta de permiso; `409`, correo ya registrado.

### Gastos estimados de IA por organización

`GET /api/organizaciones/gastos-ia` requiere rol `SYSADMIN` y permiso vigente `GASTOS_IA_VER`. `desde` y `hasta` son opcionales e independientes: filtran días completos e inclusivos en `America/Argentina/Buenos_Aires` según la fecha de creación de cada consumo. Sin filtros devuelve todo el historial; una fecha inválida o un rango invertido devuelve `400`.

```json
[
  {"uuid":"11111111-1111-4111-8111-111111111111","nombre":"Agencia Norte","activa":true,"costoEstimadoUsd":0.01500000,"llamadasSinCostoEstimado":1},
  {"uuid":"22222222-2222-4222-8222-222222222222","nombre":"Agencia Sur","activa":false,"costoEstimadoUsd":0,"llamadasSinCostoEstimado":0}
]
```

La respuesta incluye organizaciones inactivas y sin consumos en el período, ordenadas por nombre. `costoEstimadoUsd` suma todas las operaciones y reintentos, incluso fallidos con costo conocido; el costo web ya está incluido. `llamadasSinCostoEstimado` cuenta registros sin importe, por lo que un costo cero no siempre significa que no hubo llamadas. Los importes son estimaciones con las tarifas configuradas, no una factura del proveedor.

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
  "competidores": [
    {"nombre": "Taller Sur", "sitioWeb": "https://tallersur.example"}
  ]
}
```

`nombre`, `nombreMarca`, `sitioWeb`, `rubro`, `pais` e `idioma` son obligatorios. El sitio debe ser una URL completa HTTP o HTTPS. `pais` usa dos letras mayúsculas; `idioma` admite códigos como `es-AR`. El sitio de un competidor es opcional. En el alta inicial tampoco se admiten nombres de competidores duplicados, ignorando mayúsculas y espacios exteriores.

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

`estado` puede ser `ACTIVO` o `ARCHIVADO`. Los archivados siguen visibles en las rutas de lectura. Para archivar o reactivar un cliente se envía `PATCH /api/clientes-monitoreados/{clienteUuid}/estado` con uno de estos cuerpos:

```json
{"estado":"ARCHIVADO"}
```

```json
{"estado":"ACTIVO"}
```

El cambio exige `CLIENTES_CAMBIAR_ESTADO` y pertenencia a la organización del cliente. Devuelve el `DatosCliente` actualizado. Repetir el estado actual devuelve `200` sin registrar otra edición. En las rutas de lectura, un usuario de organización solo ve clientes propios y `SYSADMIN` puede leer todos; un UUID ajeno o inexistente devuelve `404`.

Para agregar un competidor después de crear el cliente, enviar `POST /api/clientes-monitoreados/{clienteUuid}/competidores` con `SolicitudCompetidor`:

```json
{"nombre":"Taller Este","sitioWeb":"https://este.example"}
```

`nombre` es obligatorio y admite hasta 200 caracteres. `sitioWeb` es opcional; si se informa, debe ser una URL HTTP o HTTPS de hasta 2048 caracteres. El `POST` devuelve `201` con el `DatosCliente` completo y la lista activa actualizada. Para dar de baja un competidor, enviar `DELETE /api/clientes-monitoreados/{clienteUuid}/competidores/{competidorUuid}` sin body; devuelve `200` con el `DatosCliente` actualizado. La baja es lógica y libera el nombre para reutilizarlo. El `GET` del cliente ya incluye los competidores activos.

Ambas escrituras exigen una cuenta de la organización dueña, cliente `ACTIVO` y el permiso correspondiente: `COMPETIDORES_CREAR` o `COMPETIDORES_ELIMINAR`. `SYSADMIN` conserva lectura global. Un cliente o competidor ajeno, inexistente o dado de baja devuelve `404`; un cliente archivado, `409`; datos inválidos, `400`. No puede haber dos competidores activos con el mismo nombre en un cliente, ignorando mayúsculas y espacios exteriores: devuelve `409` con `title: "Competidor duplicado"`.

Las normalizaciones de IA en curso terminan con la lista de competidores que recibieron al empezar. Las altas y bajas posteriores se aplican a próximas normalizaciones; los resultados históricos conservan menciones de competidores dados de baja.

## Temas

`POST` y `PATCH` de temas reciben el mismo body:

```json
{"nombre":"Gestión de talleres"}
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

`GET /api/clientes-monitoreados/{clienteUuid}/consultas/por-tema` devuelve todos los temas activos del cliente y sus consultas activas en una sola respuesta. Incluye los temas sin consultas con `consultas: []`; si el cliente no tiene temas, devuelve `[]`. Los temas se ordenan por nombre y las consultas de cada tema, desde la más reciente. Cada consulta usa `DatosConsultaConEjecucionHoy`: conserva los campos de `DatosConsulta` y agrega `ejecucionHoy`.

```json
[
  {
    "uuid": "55555555-5555-4555-8555-555555555555",
    "clienteUuid": "33333333-3333-4333-8333-333333333333",
    "nombre": "Comparaciones",
    "consultas": [
      {
        "uuid": "66666666-6666-4666-8666-666666666666",
        "clienteUuid": "33333333-3333-4333-8333-333333333333",
        "temaUuid": "55555555-5555-4555-8555-555555555555",
        "texto": "¿Qué taller me conviene para revisar los frenos?",
        "tipoConsulta": "REFERENCIA",
        "estadoConsulta": "BORRADOR",
        "prioridad": "ALTA",
        "conMarca": false,
        "ejecucionHoy": {
          "uuid": "88888888-8888-4888-8888-888888888888",
          "estadoEjecucion": "FINALIZADO",
          "estadoNormalizacion": "FINALIZADA"
        }
      }
    ]
  },
  {
    "uuid": "77777777-7777-4777-8777-777777777777",
    "clienteUuid": "33333333-3333-4333-8333-333333333333",
    "nombre": "Mantenimiento",
    "consultas": []
  }
]
```

`ejecucionHoy` es `null` si esa consulta no tiene una ejecución registrada para el día actual en `America/Argentina/Buenos_Aires`. Si existe, incluye el UUID de la ejecución y ambos estados, incluso si está pendiente o falló. Para mostrar «Analizada hoy», comprobá `estadoEjecucion === "FINALIZADO"` y `estadoNormalizacion === "FINALIZADA"`. En los demás casos, los estados permiten mostrar que está pendiente, en curso o falló. El UUID sirve para consultar el detalle de la ejecución.

Requiere los dos permisos de lectura, `TEMAS_VER` y `CONSULTAS_VER`. Una cuenta de organización solo puede ver sus clientes; SYSADMIN puede leerlos globalmente. Un cliente ajeno o inexistente devuelve `404`. Los clientes archivados siguen disponibles para lectura; los temas y consultas dados de baja no aparecen.

### Alta

`POST /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas` recibe **directamente un array JSON**, no un objeto contenedor. Cada elemento requiere `texto` (hasta 2000 caracteres), `tipoConsulta` (`REFERENCIA` o `DESCUBRIMIENTO`), `prioridad` (`ALTA`, `MEDIA` o `BAJA`) y `conMarca` (`true` o `false`, sin admitir `null`):

```json
[
  {"texto":"mejor software para talleres","tipoConsulta":"REFERENCIA","prioridad":"ALTA","conMarca":false},
  {"texto":"¿Qué opinás de FINMI?","tipoConsulta":"DESCUBRIMIENTO","prioridad":"MEDIA","conMarca":true}
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
    "prioridad": "ALTA",
    "conMarca": false
  }
]
```

El array no puede estar vacío. Un cliente admite **15 consultas activas en total**, sumando todos sus temas; dar de baja libera cupo. Dentro de un tema, una consulta activa no puede repetir texto y tipo de otra, ignorando mayúsculas y espacios exteriores. Si falla un elemento o no alcanza el cupo, no se guarda ninguno. El cliente y el tema deben estar activos.

Desde el 1 de noviembre de 2026, `DatosConsulta` y `DatosConsultaConEjecucionHoy` incluyen el booleano `conMarca`: indica si la pregunta está clasificada como una referencia a la marca del cliente. Es independiente de `tipoConsulta` y de si la marca apareció en una respuesta de IA. Se expone en altas, detalle, listados, aprobaciones, ediciones, cambios de tipo y consultas devueltas por la generación. Las altas manuales guardan la clasificación indicada por el usuario desde la creación, sin registrarla como una edición. Las nuevas generaciones guardan la clasificación informada por la IA para cada propuesta. Las correcciones ya guardadas se reflejan también al volver a consultar una generación finalizada; las consultas existentes no se reclasifican automáticamente.

El frontend debe enviar `conMarca` explícitamente en **cada elemento del alta y en cada edición completa**. Omitirlo o enviar `null` devuelve `400`; en un alta por lote se rechaza la tanda entera. No se deduce la clasificación a partir del texto ni se asigna un valor por defecto para estas solicitudes. Un valor ilegible o un JSON inválido también devuelve `400`. La clasificación no permite eludir la regla de duplicados por texto y tipo.

### Corrección de clasificación con marca/sin marca

`PATCH /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/marca` recibe `SolicitudCambiarMarcaConsulta`:

```json
{"conMarca":true}
```

`conMarca` es obligatorio y no puede ser `null`. Requiere `CONSULTAS_EDITAR`, asignado a `PROPIETARIO` y `MIEMBRO`; tener únicamente `CONSULTAS_CAMBIAR_TIPO` no habilita esta operación. SYSADMIN conserva solo lectura. La identidad del editor se obtiene del JWT y el cliente y la consulta se identifican en la ruta.

Admite consultas activas en `BORRADOR` o `APROBADA`, con cliente activo y tema de origen activo. Devuelve `200 DatosConsulta` actualizado, conservando UUID, texto, tema, prioridad, tipo, estado y cupo. Un cambio real registra editor y fecha de modificación; reenviar el mismo valor devuelve `200` sin cambiar la auditoría. La posibilidad de corregir una aprobada no habilita editar su contenido mediante `PUT` ni cambiar su tipo.

Errores: `400` por campo ausente o `null`, valor ilegible o JSON inválido; `401` sin sesión válida; `403` sin permiso; `404` por cliente o consulta inexistente, ajeno o dado de baja; `409` por cliente archivado o tema de origen inactivo. Los rechazos conservan la clasificación anterior.

La operación bloquea el cliente y la consulta antes de corregirla. Cada ejecución conserva la clasificación que capturó al crearse: una corrección afecta a las nuevas ejecuciones y no altera las anteriores, incluidas las que ya estaban en cola y sus reintentos. El frontend puede reemplazar la consulta por UUID con la respuesta recibida. La API de métricas separa ambos grupos usando esa clasificación histórica; los informes semanales nuevos conservan también la separación documentada más adelante.

### Edición completa en borrador

Incorporada al backend el 31 de octubre de 2026.

`PUT /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}` recibe los cinco campos obligatorios de `SolicitudEditarConsulta`:

```json
{
  "texto": "¿Qué software recomendás para talleres de Córdoba?",
  "temaUuid": "55555555-5555-4555-8555-555555555555",
  "prioridad": "ALTA",
  "tipoConsulta": "DESCUBRIMIENTO",
  "conMarca": false
}
```

El texto es obligatorio, admite hasta 2000 caracteres y se guarda sin espacios exteriores. `prioridad` admite `ALTA`, `MEDIA` o `BAJA`; `tipoConsulta`, `REFERENCIA` o `DESCUBRIMIENTO`. `temaUuid` debe identificar un tema activo del mismo cliente; crear un tema sigue siendo una operación separada. `conMarca` requiere un valor explícito `true` o `false`; no puede omitirse ni ser `null`.

Requiere `CONSULTAS_EDITAR`, asignado por defecto a `PROPIETARIO` y `MIEMBRO`. Este permiso es independiente de `CONSULTAS_CAMBIAR_TIPO`: tener únicamente el segundo no habilita la edición completa. SYSADMIN conserva solo lectura. La organización y el usuario editor se obtienen de la identidad autenticada, y los identificadores de cliente y consulta, de la ruta.

Solo se puede editar una consulta activa en `BORRADOR`, con cliente activo y tema de origen activo. La operación devuelve `200 DatosConsulta` con los cinco campos guardados, mantiene UUID, estado, creador y fecha de creación, y no consume otro lugar del cupo; se permite también si ya hay 15 consultas activas. Un cambio real, incluso únicamente de `conMarca`, registra editor y fecha de modificación. Reenviar los mismos valores, después de quitar espacios exteriores al texto, devuelve `200` sin cambiar la auditoría. La clasificación y el contenido se guardan juntos; un rechazo conserva ambos.

Si cambia el tema, el frontend debe quitar la consulta de su grupo anterior y agregar la respuesta en el grupo identificado por el nuevo `temaUuid`, o recargar `GET .../consultas/por-tema`. La ruta de edición conserva la misma identidad aunque cambie de tema. El detalle en el tema anterior deja de encontrarla.

Errores: `400` por campos ausentes o `null`, texto vacío o de más de 2000 caracteres, UUID o enums inválidos y JSON ilegible; `401` sin sesión válida; `403` sin permiso; `404` por cliente o consulta inexistente, ajeno o dado de baja, o tema destino inexistente, inactivo o de otro cliente; `409` por consulta aprobada, cliente archivado, tema de origen dado de baja o duplicado activo del mismo texto y tipo en el tema destino. La comparación de duplicados ignora mayúsculas y espacios exteriores y excluye la propia consulta. Un rechazo conserva todos los campos anteriores.

La edición usa el mismo bloqueo transaccional por cliente que las altas, bajas, aprobaciones y cambios de tipo. Si una aprobación se confirma primero, la edición se rechaza con `409`; si se edita primero, se puede aprobar después el contenido ya guardado.

### Cambio de tipo en borrador

`PATCH /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/tipo` recibe:

```json
{"tipoConsulta":"DESCUBRIMIENTO"}
```

Acepta `REFERENCIA` o `DESCUBRIMIENTO` solo si la consulta sigue activa y en `BORRADOR`, dentro de un tema y cliente activos de la organización autenticada. Requiere `CONSULTAS_CAMBIAR_TIPO`, asignado por defecto a `PROPIETARIO` y `MIEMBRO`; SYSADMIN conserva solo lectura. Devuelve `200` con el mismo `DatosConsulta` actualizado, sin cambiar su UUID, texto, tema, prioridad ni estado. El frontend puede reemplazar la entrada por UUID. Pedir el tipo que ya tiene también devuelve `200` y no modifica la auditoría.

Un body sin `tipoConsulta` o con otro valor devuelve `400`; un cliente o consulta inexistente, ajeno o dado de baja devuelve `404`. Una consulta `APROBADA`, un tema dado de baja, un cliente `ARCHIVADO` o un duplicado activo del mismo texto y tipo destino en el tema devuelve `409`. El cambio real registra al usuario editor y la fecha de modificación.

### Aprobación y baja por lote

Ambos endpoints reciben **directamente un array de UUID** de consultas de cualquier tema del cliente:

```json
["66666666-6666-4666-8666-666666666666"]
```

`POST .../consultas/aprobaciones` solo admite consultas activas en `BORRADOR`, dentro de temas y cliente activos. Devuelve `200` con `DatosConsulta[]` de **las consultas del lote**, en el orden solicitado y con `estadoConsulta: "APROBADA"`. El frontend puede reemplazar por UUID las entradas que ya muestra. El tipo `REFERENCIA` o `DESCUBRIMIENTO` no cambia.

`POST .../consultas/bajas` devuelve `204` sin body. La baja es lógica: la consulta desaparece de las rutas de lectura y libera un lugar del cupo. Texto, prioridad, tema, tipo y clasificación de marca pueden editarse juntos mediante `PUT .../consultas/{consultaUuid}` mientras la consulta siga en `BORRADOR`. El endpoint de cambio de tipo se mantiene compatible y conserva `conMarca`.

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

Cada consulta de una nueva generación conserva el `conMarca` informado por la IA. Las instrucciones consideran como referencia a la marca tanto el nombre del cliente como el dominio de su sitio; mencionar únicamente un competidor no cuenta como con marca. La clasificación es independiente de `REFERENCIA` o `DESCUBRIMIENTO` y se muestra también en el detalle y los listados. Se guarda como dato inicial, sin registrar una edición. El usuario puede corregirla después mediante las operaciones de edición ya documentadas.

El lote debe contener exactamente 15 consultas distintas, con al menos ocho clasificadas como sin marca (`conMarca: false`). Este mínimo se comprueba al generar, usando la clasificación recibida. Si alguna propuesta omite `conMarca`, lo informa como `null` o usa un valor distinto de un booleano JSON (por ejemplo, `"true"` o `1`), el proceso termina `FALLIDO` sin guardar temas ni consultas del lote. Lo mismo ocurre si no cumple el mínimo de ocho. Se conserva la auditoría y el consumo de la llamada y se permite iniciar un nuevo proceso. Los endpoints de generación siguen sin recibir body.

**Regla para la página del cliente:** al abrirla, pedir en paralelo `GET /api/clientes-monitoreados/{clienteUuid}` y el `GET` de generación. Mostrar solo un estado de carga hasta que **ambas solicitudes terminen**; no mostrar datos parciales del cliente ni del proceso. Un `204` del proceso cuenta como solicitud terminada. Si falla cualquiera de las dos, mostrar el error correspondiente sin presentar contenido parcial. Después de la carga inicial, consultar únicamente el estado del proceso cada 3 segundos mientras sea `PENDIENTE` o `PROCESANDO` y la página esté abierta; detener el polling al llegar a `FINALIZADO` o `FALLIDO`. Al volver a la página, repetir las dos solicitudes iniciales.

### Primera ejecución manual de una consulta

`POST /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/ejecuciones` no recibe body. Requiere `CONSULTAS_EJECUTAR`, consulta activa y `APROBADA`, tema activo y cliente `ACTIVO` de la organización autenticada. Devuelve `202` con el intento. Si esa consulta ya tiene uno en curso, devuelve el mismo UUID; después de finalizar o fallar, otro POST crea un intento nuevo. SYSADMIN solo puede leer. Si falta `OPENAI_API_KEY`, devuelve `503` sin crear el intento.

`GET /api/clientes-monitoreados/{clienteUuid}/ejecuciones/{ejecucionUuid}` consulta un intento por UUID. `GET /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/ejecuciones/ultima` permite recuperar el más reciente desde otra computadora y devuelve `204` si no existe. Ambos requieren `CONSULTAS_VER`; SYSADMIN puede leer cualquier cliente. La ejecución histórica sigue visible si luego se da de baja la consulta, mientras el cliente siga disponible.

Ejemplo de una ejecución con normalización terminada para un usuario de organización:

```json
{
  "uuid": "88888888-8888-4888-8888-888888888888",
  "consultaUuid": "66666666-6666-4666-8666-666666666666",
  "clienteUuid": "33333333-3333-4333-8333-333333333333",
  "estado": "FINALIZADO",
  "textoConsulta": "¿Qué taller conviene?",
  "tipoConsulta": "REFERENCIA",
  "nombreTema": "Opciones",
  "proveedor": "OpenAI",
  "modelo": "gpt-6.1-sol",
  "fechaInicio": "2026-10-09T20:00:00Z",
  "fechaFin": "2026-10-09T20:00:08Z",
  "duracionMs": 8000,
  "respuestaTexto": "Taller Norte es una opción.",
  "cantidadBusquedas": 1,
  "cantidadLlamadasWeb": 1,
  "citas": [{"url":"https://ejemplo.com/fuente","titulo":"Fuente",
    "indiceInicio":0,"indiceFin":12}],
  "mensaje": null,
  "estadoNormalizacion": "FINALIZADA",
  "mensajeNormalizacion": null,
  "resultadoNormalizado": {
    "nombreMarca": "Taller Norte",
    "marcaMencionada": true,
    "posicionMarca": null,
    "evidenciaMarca": "Taller Norte es una opción.",
    "modeloNormalizador": "gpt-6-luna",
    "competidores": [{
      "competidorUuid": "99999999-9999-4999-8999-999999999999",
      "nombreCompetidor": "Taller Sur",
      "mencionado": false,
      "posicion": null,
      "evidencia": null
    }],
    "fuentes": [{
      "url": "https://ejemplo.com/fuente",
      "titulo": "Fuente",
      "dominio": "ejemplo.com",
      "indiceInicio": 0,
      "indiceFin": 12
    }]
  }
}
```

Los tres endpoints de ejecución usan el mismo DTO. Para usuarios sin rol activo `SYSADMIN`, la API **omite** `tokensEntrada`, `tokensSalida` y `costoEstimadoUsd`; no llegan como `null`. SYSADMIN recibe esos campos cuando existen. `costoEstimadoUsd` refleja solo la ejecución original, no el costo adicional de normalización guardado en `consumos_ia`.

`estado` puede ser `PENDIENTE`, `PROCESANDO`, `FINALIZADO`, `FALLIDO` o `CANCELADA`. `estadoNormalizacion` puede ser `NO_REALIZADA`, `PENDIENTE`, `PROCESANDO`, `FINALIZADA`, `FALLIDA` o `CANCELADA`. Mientras la segunda llamada esté pendiente o procesando, la respuesta original puede estar `FINALIZADO`, pero `resultadoNormalizado` sigue siendo `null`. Al terminar, aparecen marca, competidores configurados (también los no mencionados) y fuentes con dominio. `posicionMarca` y `posicion` son `null` si la respuesta no contiene una clasificación ordenada; el orden de aparición no se interpreta como puesto. `citas` contiene las anotaciones originales y `resultadoNormalizado.fuentes` refleja las fuentes persistidas para el análisis.

Al abrir la vista de una consulta, pedir primero `.../ejecuciones/ultima` o el UUID de una ejecución concreta cuando se conozca. Si `estado` está en curso, consultar el intento por UUID cada 3 segundos mientras la página esté abierta. Si `estado` es `FINALIZADO` pero `estadoNormalizacion` está `PENDIENTE` o `PROCESANDO`, continuar el polling hasta `FINALIZADA`, `FALLIDA` o `CANCELADA`. Si falla la normalización, conservar la respuesta original y mostrar `mensajeNormalizacion`; `resultadoNormalizado` queda `null`. En ejecuciones anteriores a V12 o cuando falla la ejecución original, `estadoNormalizacion` es `NO_REALIZADA`. Un reinicio o vencimiento puede pasar cada fase a su estado de fallo independiente. `mensaje` describe un fallo de la ejecución original.

OpenAI recibe el texto original con búsqueda web opcional (`tool_choice: "auto"`). `cantidadBusquedas` cuenta acciones de búsqueda y `cantidadLlamadasWeb` cuenta llamadas a la herramienta; la estimación de costo usa esta última. Si hay citas, mostrarlas visibles y clicables. Texto, tipo y tema son una instantánea histórica. La respuesta literal completa se conserva en la base para auditoría. El resultado normalizado describe una sola ejecución. La solicitud no incluye ubicación de búsqueda: la configuración predeterminada del proveedor puede orientar resultados a Estados Unidos, incluso si el cliente tiene otro país guardado. Habrá que definir la localización antes de comparar países.

### Métricas GEO por cliente

`GET /api/clientes-monitoreados/{clienteUuid}/metricas?desde=2026-10-01&hasta=2026-10-31` exige ambas fechas ISO y toma los extremos inclusive según el día argentino de cada ejecución. Requiere `CONSULTAS_VER`. Una cuenta de organización solo puede leer sus clientes; SYSADMIN puede leer cualquier cliente activo. Devuelve `400` si falta una fecha, el formato es inválido o `desde` es posterior a `hasta`; otro cliente responde `404`.

Desde el paso 6b de F02, devuelve `DatosMetricasSeparadasCliente` con cinco campos en la raíz: `clienteUuid`, `desde`, `hasta`, `sinMarca` y `conMarca`. Los dos bloques están siempre presentes y contienen todos los conteos, tasas y desgloses del grupo indicado. No lleva body ni necesita un filtro de marca: ambos grupos llegan en una sola llamada. El frontend debe adaptar las lecturas del formato plano anterior; la presencia principal se obtiene de **`sinMarca.tasaMencionMarca`**.

```json
{
  "clienteUuid": "33333333-3333-4333-8333-333333333333",
  "desde": "2026-10-01",
  "hasta": "2026-10-31",
  "sinMarca": {
    "ejecuciones": 10,
    "analizadas": 8,
    "pendientes": 0,
    "fallidas": 2,
    "canceladas": 0,
    "mencionesMarca": 2,
    "tasaMencionMarca": 25.00,
    "conCitas": 2,
    "tasaCitas": 25.00,
    "conCitasSitioCliente": 1,
    "tasaCitasSitioCliente": 12.50,
    "serieDiaria": [
      {
        "dia": "2026-10-10",
        "ejecuciones": 10,
        "analizadas": 8,
        "pendientes": 0,
        "fallidas": 2,
        "canceladas": 0,
        "mencionesMarca": 2,
        "tasaMencionMarca": 25.00,
        "conCitas": 2,
        "tasaCitas": 25.00,
        "conCitasSitioCliente": 1,
        "tasaCitasSitioCliente": 12.50,
        "modelosAnalizados": {
          "gpt-6.1-sol": 4,
          "gpt-6-luna": 4
        }
      }
    ],
    "competidores": [
      {
        "competidorUuid": "99999999-9999-4999-8999-999999999999",
        "nombre": "Taller Sur",
        "evaluaciones": 2,
        "menciones": 1,
        "tasaMencion": 50.00
      }
    ],
    "consultasMencionadas": [
      {
        "consultaUuid": "66666666-6666-4666-8666-666666666666",
        "textoConsulta": "¿Qué taller conviene?",
        "mencionesMarca": 1
      },
      {
        "consultaUuid": "77777777-7777-4777-8777-777777777777",
        "textoConsulta": "Pregunta sin marca 2",
        "mencionesMarca": 1
      }
    ]
  },
  "conMarca": {
    "ejecuciones": 4,
    "analizadas": 2,
    "pendientes": 1,
    "fallidas": 0,
    "canceladas": 1,
    "mencionesMarca": 2,
    "tasaMencionMarca": 100.00,
    "conCitas": 2,
    "tasaCitas": 100.00,
    "conCitasSitioCliente": 1,
    "tasaCitasSitioCliente": 50.00,
    "serieDiaria": [
      {
        "dia": "2026-10-10",
        "ejecuciones": 4,
        "analizadas": 2,
        "pendientes": 1,
        "fallidas": 0,
        "canceladas": 1,
        "mencionesMarca": 2,
        "tasaMencionMarca": 100.00,
        "conCitas": 2,
        "tasaCitas": 100.00,
        "conCitasSitioCliente": 1,
        "tasaCitasSitioCliente": 50.00,
        "modelosAnalizados": {
          "gpt-6.1-sol": 1,
          "gpt-6-luna": 1
        }
      }
    ],
    "competidores": [
      {
        "competidorUuid": "99999999-9999-4999-8999-999999999999",
        "nombre": "Taller Sur",
        "evaluaciones": 1,
        "menciones": 1,
        "tasaMencion": 100.00
      }
    ],
    "consultasMencionadas": [
      {
        "consultaUuid": "88888888-8888-4888-8888-888888888888",
        "textoConsulta": "Pregunta sobre Taller Norte",
        "mencionesMarca": 1
      },
      {
        "consultaUuid": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "textoConsulta": "Pregunta sobre tallernorte.example",
        "mencionesMarca": 1
      }
    ]
  }
}
```

Cada grupo incluye `ejecuciones`, `analizadas`, `pendientes`, `fallidas`, `canceladas`, `mencionesMarca`, `tasaMencionMarca`, `conCitas`, `tasaCitas`, `conCitasSitioCliente`, `tasaCitasSitioCliente`, `serieDiaria`, `competidores` y `consultasMencionadas`. La pertenencia se determina por `conMarca` guardado al crear la ejecución, independientemente del valor actual de la consulta y de su tipo `REFERENCIA` o `DESCUBRIMIENTO`. Corregir una consulta no mueve sus mediciones anteriores de grupo. Una misma consulta puede figurar en ambos desgloses si tuvo ejecuciones con distinta clasificación.

Cada `serieDiaria` tiene una sola entrada por día con ejecuciones de su grupo, aunque se hayan usado Sol y Luna; `modelosAnalizados` informa cuántas mediciones completas aportó cada modelo. Los días sin ejecuciones del grupo no aparecen; el frontend puede alinear las dos series por `dia`. Solo entran al denominador de las tasas las ejecuciones `FINALIZADO` con normalización `FINALIZADA` y resultado guardado. `pendientes`, `fallidas` y `canceladas` se informan aparte; una normalización cancelada también cuenta como cancelación de la medición. Una respuesta cuenta una sola vez en `conCitas` si cita alguna fuente, y una sola vez en `conCitasSitioCliente` si cita el dominio del sitio del cliente o un subdominio. Cada competidor usa como denominador las respuestas de ese grupo en las que fue evaluado, por lo que puede diferir del total del grupo.

Las tasas son porcentajes entre 0 y 100 con dos decimales y se calculan sobre los conteos del período de cada grupo, sin promediar porcentajes diarios ni tasas entre grupos. Cuando el denominador es cero llegan como `null`; un grupo con muestra y ninguna mención tiene tasa `0.00`. Si no hay ejecuciones en un grupo, todos sus conteos son cero, sus tasas son `null` y sus tres listas son `[]`. Si hay trabajos pendientes o fallidos, sus conteos y días pueden estar presentes aunque todavía no haya muestra analizada. Una normalización marcada como finalizada pero sin resultado persistido provoca error de la respuesta completa.

En cada bloque, `consultasMencionadas` agrupa por UUID de consulta las respuestas de ese grupo y período que nombraron la marca. Cada ejecución terminada y normalizada suma como máximo una mención, aunque el nombre aparezca varias veces en el texto. Solo incluye consultas con `mencionesMarca > 0` y devuelve como máximo las 15 más mencionadas del grupo, ordenadas de mayor a menor; los empates se resuelven por texto y UUID. Si no hubo menciones, devuelve `[]`. Conserva consultas dadas de baja que tuvieron mediciones dentro del rango. El total `mencionesMarca` del grupo incluye también las consultas que queden fuera de esas 15, por lo que puede ser mayor que la suma del desglose. Este desglose se ofrece en la API de métricas y no se duplica en el contexto enviado al análisis semanal.

Se preservan mediciones de consultas luego dadas de baja. Los registros antiguos que quedaron sin `diaEjecucion` durante V13 no participan en estas métricas para evitar duplicados del mismo día. Las tasas se calculan al pedirlas, sin caché ni tabla de métricas. La comparación de citas propias usa el sitio web actual del cliente; si más adelante se permite editarlo, habrá que conservar el dominio por ejecución para mantener la clasificación histórica.

### Análisis semanal manual

La ruta base es `/api/clientes-monitoreados/{clienteUuid}/analisis-semanales`. `POST` no recibe body y devuelve `202` con el proceso. Al abrir la página del cliente, consultar `GET .../ultimo` para recuperar el trabajo aunque se haya iniciado desde otra computadora. Si devuelve `PENDIENTE` o `PROCESANDO`, sondear esa misma ruta o `GET .../{analisisUuid}` hasta recibir `FINALIZADO`, `FALLIDO` o `CANCELADO`. `GET` de historial usa `pagina=0` por defecto y 20 elementos por página. SYSADMIN puede leer cualquier cliente; PROPIETARIO y MIEMBRO pueden iniciar y leer solo los de su organización.

Desde el paso 7a de F02, los nuevos análisis envían a la IA un contexto propio con `metricas.sinMarca` y `metricas.conMarca`. Cada grupo conserva los conteos, tasas, serie diaria y competidores calculados por el backend, sin repetir `consultasMencionadas`: las preguntas y sus evidencias ya viajan en `ejecuciones`. Cada ejecución incluye `conMarca`, tomado de su clasificación histórica; `marcaMencionada` sigue indicando la aparición de la marca en la respuesta. La IA recibe instrucciones para distinguir ambos conceptos, usar `sinMarca` como presencia espontánea, conservar las tasas calculadas y tratar `null` como ausencia de muestra analizada.

Desde el paso 7b de F02, el informe generado a partir de un contexto separado contiene `sinMarca` y `conMarca`. Ambos bloques están siempre presentes, cada uno con `resumen`, `hallazgos` y `recomendaciones`. `sinMarca` corresponde a presencia espontánea; `conMarca`, a respuestas de preguntas que nombran a la marca. No hay un resumen combinado en la raíz. El frontend debe distinguir el nuevo formato por la presencia de ambos bloques y conservar la presentación anterior para informes con los tres campos planos.

F03 agrega `informe.competidoresDetectados` en las respuestas existentes del último análisis (`GET .../ultimo`), detalle (`GET .../{analisisUuid}`) e historial (`GET ...?pagina=0`). Es una lista general del período, al mismo nivel que `sinMarca` y `conMarca`, que se muestra una sola vez. Cada elemento contiene `nombre`, `pregunta` (texto histórico visible) y `urlFuente` (URL o `null`):

```json
"competidoresDetectados": [
  {"nombre":"Agencia Rival","pregunta":"¿Qué agencias recomendás para una PyME industrial?","urlFuente":"https://rival.example/comparacion"},
  {"nombre":"Otra Agencia","pregunta":"¿Qué agencias recomendás para una PyME industrial?","urlFuente":null}
]
```

Cuando la lista está vacía, mostrar «No se identificaron competidores en las respuestas analizadas». Si está ausente o es `null`, ocultar la sección para conservar la presentación de los informes anteriores, tanto planos como separados. Si `informe` es `null`, mantener el tratamiento actual del proceso. El enlace «Ver fuente» se muestra solo cuando hay una URL web válida y abre en otra pestaña con `rel="noopener noreferrer"`; sin enlace se conservan nombre y pregunta. La lista puede incluir empresas ajenas al catálogo del cliente y no requiere resolver UUID ni realizar consultas adicionales.

Los contextos e informes anteriores se conservan sin reescribir: un reintento reutiliza exactamente la muestra guardada. Si tiene métricas combinadas, mantiene el formato anterior; si tiene métricas separadas, genera el nuevo. Se mantienen los fragmentos de hasta 600 caracteres, las citas, los conteos de fallos y los días sin resultados; su exclusión corresponde a F07.

Ejemplo abreviado de respuesta `200` finalizada con muestra sin marca y sin muestra con marca:

```json
{
  "uuid": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "clienteUuid": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "desde": "2026-10-09",
  "hasta": "2026-10-15",
  "estado": "FINALIZADO",
  "fechaInicio": "2026-10-15T18:00:00Z",
  "fechaFin": "2026-10-15T18:00:20Z",
  "intentos": 1,
  "mensaje": null,
  "informe": {
    "sinMarca": {
      "resumen": "La marca apareció en parte de las respuestas a preguntas sin marca.",
      "hallazgos": [{"descripcion": "Una respuesta mencionó la marca.", "ejecuciones": ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]}],
      "recomendaciones": [{"titulo": "Ampliar contenidos", "accion": "Publicar respuestas a las dudas más frecuentes.", "prioridad": "MEDIA", "ejecuciones": ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]}]
    },
    "conMarca": {
      "resumen": "No hay respuestas analizadas en este grupo durante el período.",
      "hallazgos": [],
      "recomendaciones": []
    }
  }
}
```

Cada referencia de un bloque debe ser un `ejecucionUuid` de ese mismo grupo en la muestra congelada; no sirve el `consultaUuid`, una ejecución de otro grupo ni una de otro cliente. El máximo es de ocho hallazgos y cinco recomendaciones **en total entre ambos bloques**. Un bloque con muestra debe tener al menos un hallazgo. Uno sin muestra usa exactamente el resumen de ausencia mostrado en el ejemplo y ambas listas vacías; no se interpreta como una tasa de 0 %. Las tasas se toman de las métricas del contexto, sin mezclarlas entre grupos.

Los informes anteriores siguen devolviendo este contenido de `informe`, sin agregar bloques nulos ni reclasificar sus evidencias:

```json
{
  "resumen": "La marca apareció en parte de las respuestas analizadas.",
  "hallazgos": [{"descripcion": "Una respuesta mencionó la marca.", "ejecuciones": ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]}],
  "recomendaciones": [{"titulo": "Ampliar contenidos", "accion": "Publicar respuestas a las dudas más frecuentes.", "prioridad": "MEDIA", "ejecuciones": ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]}]
}
```

`informe` es `null` mientras el trabajo no termine o si falla. Sus UUID de `ejecuciones` pertenecen a la muestra usada para el análisis. Los últimos siete días son los días calendario de Argentina hasta el día del inicio, inclusive. Se aceptan datos parciales, pero sin ejecuciones finalizadas y normalizadas el POST devuelve `409` con `detail`. Otro POST durante un trabajo abierto devuelve el mismo proceso; tras un fallo reintenta con el mismo UUID y la misma muestra. Después de finalizar correctamente, el plan Básico exige siete días completos antes de otro POST; hasta entonces devuelve `409`. Sin clave de OpenAI devuelve `503`. La generación automática del informe todavía no está habilitada.

## Errores y estados para la interfaz

| Estado | Tratamiento recomendado |
| --- | --- |
| `400` | Body inválido o regla de entrada incumplida; mostrar el motivo disponible junto al formulario. |
| `401` | Falta JWT, venció o la sesión ya no es válida; intentar renovar cuando corresponda. |
| `403` | La cuenta carece del permiso o rol necesario. |
| `404` | Recurso inexistente, inactivo u oculto por pertenecer a otra organización. |
| `409` | Conflicto de estado o unicidad, como duplicados, cupo completo o cliente archivado. |
| `503` | La integración de OpenAI no tiene clave configurada para iniciar el proceso. |

En consultas, los errores de validación y negocio usan `application/problem+json` y exponen `status` y `detail`. Ejemplo ilustrativo:

```json
{"type":"about:blank","title":"Conflict","status":409,"detail":"No se aprobó ninguna consulta. UUID 2 ya fue aprobada."}
```

No todas las rutas usan el mismo cuerpo de error: algunas respuestas de autenticación son vacías. El frontend debe tomar el **estado HTTP** como fuente principal y mostrar `detail` solo cuando venga en el JSON. La identidad y la organización no se toman de campos añadidos por el frontend: las determina el backend desde el JWT y la ruta.

## Funciones todavía sin endpoint

- Listar, editar o eliminar otros usuarios.
- Editar los datos de clientes o de competidores existentes.
- Dar de baja temas mediante HTTP.
- Programar monitoreos automáticos y ejecutar contra proveedores adicionales.

Estas funciones aparecen en la visión del producto, pero el frontend aún no puede conectarlas a una API existente. Para ampliar el contrato, actualizar este documento cuando se implemente cada función. La colección [consultas.postman_collection.json](consultas.postman_collection.json) contiene las rutas de gestión de consultas anteriores a la ejecución manual.
