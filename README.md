# Gelaia frontend

Interfaz React + TypeScript para los endpoints implementados en [CONTRATO_FRONTEND.md](docs/CONTRATO_FRONTEND.md). El [contexto del proyecto](docs/CONTEXTO_PROYECTO.md) describe funciones futuras que todavía no tienen API.

## Desarrollo

Requiere Node.js 22 y pnpm. Copiar `.env.example` a `.env.local` si la API no escucha en `http://localhost:8080` y configurar `VITE_API_PROXY_TARGET` con su origen. Luego:

```bash
pnpm install
pnpm dev
```

El navegador usa rutas relativas `/api`. Vite las dirige al backend; el JWT de acceso permanece solo en memoria y la cookie de renovación es HttpOnly. En una recarga se intenta restaurar la sesión con `POST /api/autenticacion/renovar`.

## Despliegue en el VPS

Para instalarlo junto al backend ya desplegado en `/opt/geotrack`, con Compose, Caddy y el botón manual de GitHub Actions, seguir [Despliegue del frontend en el VPS](docs/DESPLIEGUE_VPS.md).

## Imagen Docker independiente

Para una prueba local donde el contenedor pueda alcanzar el backend mediante `host.docker.internal`:

```bash
docker build -t gelaia-fe .
docker run --rm -p 127.0.0.1:8082:80 -e API_UPSTREAM=http://host.docker.internal:8080 gelaia-fe
```

`API_UPSTREAM` es el **origen alcanzable desde el contenedor** del backend, sin `/api` al final. En una red Docker compartida puede ser, por ejemplo, `http://nombre-del-servicio:8080`. En la VPS se configura al iniciar el contenedor; no hace falta reconstruir el frontend. Si hay un proxy TLS delante de Nginx, establecer también `API_FORWARDED_PROTO=https` y configurar el backend para que confíe en ese encabezado y emita la cookie con `Secure`. El frontend y `/api` deben publicarse en el mismo origen para que funcione la cookie `SameSite=Strict`.

La imagen sirve archivos estáticos con Nginx y redirige `/api` al backend. No incluye credenciales ni secretos. El puerto de la API y su dirección no se envían al navegador.

## Alcance disponible

- Ingreso, renovación y salida; vistas según permisos de `GET /api/autenticacion/actual`.
- Alta y listado de organizaciones activas, y alta de usuarios para `SYSADMIN`.
- Alta y lectura de clientes con competidores; lectura de clientes archivados.
- Alta, lectura y cambio de nombre de temas.
- Alta de consultas por lote, lectura individual y agrupada por tema, cambio de tipo en borradores, aprobación y baja lógica por lote.
- Generación asistida de borradores con estado del proceso y actualización cada 3 segundos mientras está activo.
- Ejecución manual de consultas aprobadas, recuperación del último intento, respuesta, citas y datos de uso.
- F02: clasificación explícita con marca/sin marca en altas y ediciones, y corrección de clasificación de borradores y aprobadas con `CONSULTAS_EDITAR`.
- Métricas por grupo histórico, presencia espontánea sin marca, exploración diaria y PDF separado.
- Análisis semanal con informes separados o anteriores combinados, historial, reintentos y apertura de evidencias por ejecución.

La clasificación manual no se infiere del texto. Sus correcciones se aplican a nuevas mediciones; las anteriores y las que ya están en cola conservan su grupo. Los monitoreos programados quedan fuera de F02.

## Novedades del producto

Los anuncios se editan en `src/datos/novedades.ts`. Cada entrada requiere un `id` único, `titulo`, `descripcion`, `publicadaEn` y `expiraEn`. Usar fechas ISO con zona horaria explícita; por ejemplo, desde `2026-11-02T00:00:00-03:00` hasta `2026-11-04T00:00:00-03:00` son 48 horas. La publicación es inclusiva y el vencimiento exclusivo. Solo incluir información general del producto: el archivo forma parte del frontend público.

Opcionalmente, `permisos` limita el anuncio a cuentas con al menos uno de esos permisos de `GET /api/autenticacion/actual`, y `tiposCuenta` restringe el tipo de cuenta. Si se omiten, el anuncio está disponible para cualquier cuenta autenticada durante su vigencia. Las fechas inválidas o los intervalos vacíos no se muestran.

El botón flotante abre las novedades vigentes y permanece disponible después de leerlas. Si no hay ninguna, se oculta. Las fechas se comprueban con el reloj del dispositivo, también con la aplicación abierta y al volver a la pestaña. No usa almacenamiento del navegador ni endpoints adicionales. Agregar o modificar anuncios requiere desplegar el frontend; su vencimiento es automático.

## Verificación

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Las pruebas usan `node:test`, TypeScript y React ya instalados, sin dependencias adicionales. Cubren contratos HTTP, permisos, estados locales, renderizado y recorridos completos sobre una compilación de producción con API simulada exclusivamente en las pruebas.

Las pruebas de navegador detectan Edge, Chrome o Chromium. Para otra ubicación, configurar `NAVEGADOR_PRUEBAS` con la ruta del ejecutable. Si no hay navegador, ese bloque se informa como omitido; las demás pruebas se ejecutan igualmente. Los perfiles y la compilación temporal quedan bajo `node_modules/.tmp` y no usan la API real.
