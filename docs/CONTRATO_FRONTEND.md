# Contrato para el frontend

Estado documentado al 16 de octubre de 2026. Este documento describe la API implementada y los contratos acordados para los cambios de estado, la gestión de competidores, el análisis semanal manual y los gastos estimados de IA. [CONTEXTO_PROYECTO.md](CONTEXTO_PROYECTO.md) explica la visión del producto y también contiene funciones futuras; no debe usarse como lista de endpoints disponibles.

## Qué puede construir el frontend ahora

- Inicio y cierre de sesión, renovación del acceso y consulta de la cuenta actual.
- Para `SYSADMIN` con los permisos correspondientes: lectura de planes, alta y listado de organizaciones, alta, listado, baja y reactivación de usuarios, y gastos estimados de IA por organización.
- Para `PROPIETARIO` con los permisos correspondientes: alta, listado, baja y reactivación de usuarios de su propia organización. Todas las cuentas pueden consultar y actualizar su perfil y cambiar su contraseña.
- Para usuarios de organización: alta, lectura, archivo y reactivación de clientes monitoreados; alta, lectura y baja lógica de competidores; alta, lectura y cambio de nombre de temas; alta, lectura, aprobación y baja lógica de consultas.
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
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/aprobaciones` | Array de UUID | `200 DatosConsulta[]` | `CONSULTAS_APROBAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/bajas` | Array de UUID | `204` | `CONSULTAS_ELIMINAR` |
| `POST /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/ejecuciones` | — | `202 DatosEjecucionConsulta` | `CONSULTAS_EJECUTAR` |
| `GET /api/clientes-monitoreados/{clienteUuid}/ejecuciones/{ejecucionUuid}` | — | `200 DatosEjecucionConsulta` | `CONSULTAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/consultas/{consultaUuid}/ejecuciones/ultima` | — | `200 DatosEjecucionConsulta` o `204` | `CONSULTAS_VER` |
| `GET /api/clientes-monitoreados/{clienteUuid}/metricas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | — | `200 DatosMetricasCliente` | `CONSULTAS_VER` |
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

`GET /api/clientes-monitoreados/{clienteUuid}/consultas/por-tema` devuelve todos los temas activos del cliente y sus consultas activas en una sola respuesta. Incluye los temas sin consultas con `consultas: []`; si el cliente no tiene temas, devuelve `[]`. Los temas se ordenan por nombre y las consultas de cada tema, desde la más reciente. Cada consulta usa `DatosConsultaConEjecucionHoy`: conserva los campos de `DatosConsulta` y agrega `ejecucionHoy`:

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

Requiere los dos permisos de lectura, `TEMAS_VER` y `CONSULTAS_VER`. Una cuenta de organización solo puede ver sus clientes; SYSADMIN puede leerlos globalmente. Un cliente ajeno o inexistente devuelve `404`. Los clientes archivados siguen disponibles para lectura; los temas y consultas dados de baja no aparecen.

`ejecucionHoy` es `null` si la consulta no tiene una ejecución registrada para el día actual en `America/Argentina/Buenos_Aires`. Si existe, incluye su UUID y ambos estados, aunque esté pendiente o haya fallado. Mostrar «Analizada hoy» solo cuando `estadoEjecucion` es `FINALIZADO` y `estadoNormalizacion` es `FINALIZADA`. El UUID permite consultar el detalle exacto de la ejecución.

### Alta

`POST /api/clientes-monitoreados/{clienteUuid}/temas/{temaUuid}/consultas` recibe **directamente un array JSON**, no un objeto contenedor. Cada elemento requiere `texto` (hasta 2000 caracteres), `tipoConsulta` (`REFERENCIA` o `DESCUBRIMIENTO`) y `prioridad` (`ALTA`, `MEDIA` o `BAJA`):

```json
[
  {"texto":"mejor software para talleres","tipoConsulta":"REFERENCIA","prioridad":"ALTA"},
  {"texto":"herramientas nuevas para talleres","tipoConsulta":"DESCUBRIMIENTO","prioridad":"MEDIA"}
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

`POST .../consultas/bajas` devuelve `204` sin body. La baja es lógica: la consulta desaparece de las rutas de lectura y libera un lugar del cupo. No hay edición de texto, prioridad o tema; para reemplazarlos, dar de baja la consulta y crear otra. El tipo solo puede cambiarse mientras la consulta siga en `BORRADOR`.

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

```json
{
  "clienteUuid": "33333333-3333-4333-8333-333333333333",
  "desde": "2026-10-01",
  "hasta": "2026-10-31",
  "ejecuciones": 4,
  "analizadas": 2,
  "pendientes": 1,
  "fallidas": 1,
  "mencionesMarca": 1,
  "tasaMencionMarca": 50.00,
  "conCitas": 2,
  "tasaCitas": 100.00,
  "conCitasSitioCliente": 1,
  "tasaCitasSitioCliente": 50.00,
  "serieDiaria": [{
    "dia": "2026-10-09",
    "ejecuciones": 1,
    "analizadas": 0,
    "pendientes": 0,
    "fallidas": 1,
    "mencionesMarca": 0,
    "tasaMencionMarca": null,
    "conCitas": 0,
    "tasaCitas": null,
    "conCitasSitioCliente": 0,
    "tasaCitasSitioCliente": null,
    "modelosAnalizados": {}
  }, {
    "dia": "2026-10-10",
    "ejecuciones": 3,
    "analizadas": 2,
    "pendientes": 1,
    "fallidas": 0,
    "mencionesMarca": 1,
    "tasaMencionMarca": 50.00,
    "conCitas": 2,
    "tasaCitas": 100.00,
    "conCitasSitioCliente": 1,
    "tasaCitasSitioCliente": 50.00,
    "modelosAnalizados": {"gpt-6.1-sol": 1, "gpt-6-luna": 1}
  }],
  "competidores": [{
    "competidorUuid": "99999999-9999-4999-8999-999999999999",
    "nombre": "Taller Sur",
    "evaluaciones": 2,
    "menciones": 1,
    "tasaMencion": 50.00
  }],
  "consultasMencionadas": [{
    "consultaUuid": "66666666-6666-4666-8666-666666666666",
    "textoConsulta": "¿Qué taller conviene?",
    "mencionesMarca": 1
  }]
}
```

La serie tiene una sola entrada por día con ejecuciones, aunque se hayan usado Sol y Luna; `modelosAnalizados` informa cuántas mediciones completas aportó cada modelo. Solo entran al denominador las ejecuciones `FINALIZADO` con normalización `FINALIZADA` y resultado guardado. `pendientes` y `fallidas` se informan aparte. Una respuesta cuenta una sola vez en `conCitas` si cita alguna fuente, y una sola vez en `conCitasSitioCliente` si cita el dominio del sitio del cliente o un subdominio. Las tasas son porcentajes entre 0 y 100 con dos decimales; cuando el denominador es cero llegan como `null`, no como cero. La tasa de mención combina todas las consultas, incluso las que nombran la marca: no debe rotularse como presencia espontánea. Cada competidor usa como denominador las respuestas en las que fue evaluado, por lo que puede diferir del total del cliente. Los días sin ejecuciones no aparecen en `serieDiaria`.

`consultasMencionadas` agrupa por UUID de consulta las respuestas del período que nombraron la marca. Cada ejecución terminada y normalizada suma como máximo una mención, aunque el nombre aparezca varias veces en el texto. Solo incluye consultas con `mencionesMarca > 0`, ordenadas de mayor a menor; si no hubo menciones, devuelve `[]`. Conserva consultas dadas de baja que tuvieron mediciones dentro del rango. La suma de sus conteos coincide con `mencionesMarca` del cliente.

Se preservan mediciones de consultas luego dadas de baja. Los registros antiguos que quedaron sin `diaEjecucion` durante V13 no participan en estas métricas para evitar duplicados del mismo día. Las tasas se calculan al pedirlas, sin caché ni tabla de métricas. La comparación de citas propias usa el sitio web actual del cliente; si más adelante se permite editarlo, habrá que conservar el dominio por ejecución para mantener la clasificación histórica.

### Análisis semanal manual

La ruta base es `/api/clientes-monitoreados/{clienteUuid}/analisis-semanales`. `POST` no recibe body y devuelve `202` con el proceso. Al abrir la pantalla de análisis del cliente, consultar `GET .../ultimo` para recuperar el trabajo aunque se haya iniciado desde otra computadora. Si devuelve `PENDIENTE` o `PROCESANDO`, sondear esa ruta o `GET .../{analisisUuid}` hasta `FINALIZADO`, `FALLIDO` o `CANCELADO`. El historial usa `pagina=0` por defecto y 20 elementos por página. SYSADMIN puede leer cualquier cliente; PROPIETARIO y MIEMBRO pueden iniciar y leer solo los de su organización.

Ejemplo abreviado de respuesta finalizada:

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
    "resumen": "La marca apareció en parte de las respuestas analizadas.",
    "hallazgos": [{"descripcion": "Una respuesta mencionó la marca.", "ejecuciones": ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]}],
    "recomendaciones": [{"titulo": "Ampliar contenidos", "accion": "Publicar respuestas a las dudas más frecuentes.", "prioridad": "MEDIA", "ejecuciones": ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]}]
  }
}
```

`informe` es `null` mientras el trabajo no termine o si falla. Los UUID de `ejecuciones` pertenecen a la muestra usada para el análisis. Los últimos siete días son los días calendario de Argentina hasta el día del inicio, inclusive. Se aceptan datos parciales, pero sin ejecuciones finalizadas y normalizadas el POST devuelve `409` con `detail`. Otro POST durante un trabajo abierto devuelve el mismo proceso; tras un fallo reintenta con el mismo UUID y la misma muestra. Después de finalizar correctamente, el plan Básico exige siete días completos antes de otro POST; hasta entonces devuelve `409`. Sin clave de OpenAI devuelve `503`. La generación automática del informe todavía no está habilitada.

Un cliente archivado puede consultarse, pero no iniciar un análisis nuevo: el POST devuelve `409`. `prioridad` en las recomendaciones puede ser `ALTA`, `MEDIA` o `BAJA`.

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
