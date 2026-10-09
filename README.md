# Geotrack frontend

Interfaz React + TypeScript para los endpoints implementados en [CONTRATO_FRONTEND.md](docs/CONTRATO_FRONTEND.md). El [contexto del proyecto](docs/CONTEXTO_PROYECTO.md) describe funciones futuras que todavía no tienen API.

## Desarrollo

Requiere Node.js 22 y pnpm. Copiar `.env.example` a `.env.local` si la API no escucha en `http://localhost:8080` y configurar `VITE_API_PROXY_TARGET` con su origen. Luego:

```bash
pnpm install
pnpm dev
```

El navegador usa rutas relativas `/api`. Vite las dirige al backend; el JWT de acceso permanece solo en memoria y la cookie de renovación es HttpOnly. En una recarga se intenta restaurar la sesión con `POST /api/autenticacion/renovar`.

## Producción con Docker

```bash
docker build -t geotrack-fe .
docker run --rm -p 8081:80 -e API_UPSTREAM=http://host.docker.internal:8080 geotrack-fe
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

No se muestran resultados de monitoreo, métricas ni recomendaciones porque aún no existen endpoints para esas funciones. La organización para crear un usuario se elige del listado de organizaciones activas. Todavía no existe un listado de usuarios.

## Verificación

```bash
pnpm build
pnpm lint
```
