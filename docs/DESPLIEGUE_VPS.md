# Despliegue del frontend en el VPS

El backend existente sigue en `/opt/geotrack`. Su servicio `aplicacion` publica la API en `127.0.0.1:8081` y Caddy ya atiende HTTPS. Este repositorio se instala aparte en `/opt/geotrack-fe`: Nginx sirve la interfaz en `127.0.0.1:8082` y reenvía `/api` al servicio `aplicacion` por la red Docker del backend. El navegador usa únicamente `https://app.gelaia.com`.

## 1. Comprobar el backend y la red

En el VPS:

```sh
cd /opt/geotrack
docker compose ps
curl -fsS http://127.0.0.1:8081/actuator/health
docker inspect "$(docker compose ps -q aplicacion)" --format '{{range $nombre, $datos := .NetworkSettings.Networks}}{{println $nombre}}{{end}}'
```

Anotar el nombre de la red a la que pertenece `aplicacion`. Si el proyecto Compose conserva su nombre por defecto, será `geotrack_default`. Confirmarlo con el comando; no crear otra red ni detener el backend.

## 2. Dar acceso de lectura al repositorio del frontend

El VPS necesita poder hacer `git pull` del repositorio `SantiagoVarela2001/geotrack-fe`. Si ya tiene una credencial con acceso, comprobarlo con `git ls-remote git@github.com:SantiagoVarela2001/geotrack-fe.git HEAD` y seguir al paso 3. Si la clave actual solo accede al repositorio del backend, crear otra clave en el VPS:

```sh
ssh-keygen -t ed25519 -f /root/.ssh/geotrack_fe_lectura -C geotrack-fe-vps
cat /root/.ssh/geotrack_fe_lectura.pub
```

Dejar vacía la frase de contraseña para permitir la actualización automática. Agregar **solo la línea pública** en GitHub → repositorio `geotrack-fe` → Settings → Deploy keys, sin permiso de escritura. La clave privada queda en el VPS. Verificar que la identidad SSH de GitHub ya esté registrada y comprobada en `known_hosts` antes de conectarse; la instalación del backend puede haber hecho esta preparación.

## 3. Instalar y configurar el frontend

Después de subir estos archivos a la rama `main`, elegir **una sola** forma de clonar. Si el VPS ya tiene acceso al repositorio:

```sh
git clone git@github.com:SantiagoVarela2001/geotrack-fe.git /opt/geotrack-fe
cd /opt/geotrack-fe
```

Si se creó una clave exclusiva de lectura, usar esta variante y dejarla configurada para los siguientes `git pull`:

```sh
GIT_SSH_COMMAND='ssh -i /root/.ssh/geotrack_fe_lectura -o IdentitiesOnly=yes' git clone git@github.com:SantiagoVarela2001/geotrack-fe.git /opt/geotrack-fe
cd /opt/geotrack-fe
git config core.sshCommand 'ssh -i /root/.ssh/geotrack_fe_lectura -o IdentitiesOnly=yes'
```

Crear el entorno local y revisar los valores:

```sh
cp .env.example .env
chmod 600 .env
```

En `.env`, establecer `RED_DOCKER_BACKEND` con el nombre observado en el paso 1. `API_UPSTREAM=http://aplicacion:8080` usa el nombre del servicio del backend dentro de esa red. `PUERTO_FRONTEND=8082` debe estar libre. `VITE_API_PROXY_TARGET` solo sirve al desarrollo local.

Comprobar la configuración y arrancar:

```sh
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
curl -fsS http://127.0.0.1:8082/
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8082/api/autenticacion/actual
```

La última petición debe devolver `401` porque se hace sin JWT. `502` indica que Nginx no alcanza al backend: revisar `RED_DOCKER_BACKEND`, `API_UPSTREAM` y `docker compose logs --tail=100 frontend`. El puerto 8082 solo escucha en localhost del VPS.

## 4. Publicar app.gelaia.com con Caddy

Crear el registro DNS `A` de `app.gelaia.com` hacia la IP pública del VPS. Cuando resuelva, agregar este bloque al Caddyfile existente, conservando los sitios que ya atiende:

```caddyfile
app.gelaia.com {
    reverse_proxy 127.0.0.1:8082
}
```

Antes de recargar, comprobar la ruta real del Caddyfile y su configuración actual. Si se usa `/etc/caddy/Caddyfile` y Caddy como servicio del sistema:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -I https://app.gelaia.com/
curl -sS -o /dev/null -w '%{http_code}\n' https://app.gelaia.com/api/autenticacion/actual
```

La API debe volver a responder `401` sin sesión, ahora en el mismo origen que la interfaz. Probar el ingreso desde el navegador y comprobar que la cookie de renovación sea `HttpOnly` y `Secure`. La contraseña no se escribe en comandos ni se comparte por chat.

## 5. Actualización manual

```sh
cd /opt/geotrack-fe
git pull --ff-only origin main
docker compose up -d --build --wait
docker compose ps
```

El script `scripts/desplegar-vps.sh` hace lo mismo, pero exige que el árbol de Git esté limpio y en `main`, y comprueba que `/api/autenticacion/actual` responda `401` sin sesión. `.env` queda únicamente en el VPS. El despliegue del frontend no reconstruye ni reinicia PostgreSQL o el backend.

## 6. Botón manual de GitHub Actions

El workflow `.github/workflows/desplegar-vps.yml` se ejecuta solo con **Actions → Desplegar frontend en VPS → Run workflow**, en `main`. Prepararlo después de verificar el primer despliegue manual:

1. En Windows, generar otra clave, exclusiva para este workflow: `ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\geotrack_fe_actions" -C "geotrack-fe-actions"`. Dejar la frase de contraseña vacía.
2. Agregar la línea completa de `geotrack_fe_actions.pub` al final de `/root/.ssh/authorized_keys` en el VPS, precedida por `restrict,command="/bin/bash /opt/geotrack-fe/scripts/desplegar-vps.sh" `. No reemplazar la clave usada por el backend. Mantener `/root/.ssh` con permisos `700` y `authorized_keys` con `600`.
3. Obtener la **clave pública** del host con `cat /etc/ssh/ssh_host_ed25519_key.pub`. No copiar la clave privada del host.
4. En GitHub → repositorio `geotrack-fe` → Settings → Secrets and variables → Actions, definir la variable `VPS_HOST` con la IP pública del VPS y los secretos `VPS_SSH_PRIVATE_KEY` (contenido completo de `geotrack_fe_actions`, sin `.pub`) y `VPS_SSH_HOST_PUBLIC_KEY` (la línea pública obtenida en el paso 3).
5. Ejecutar el workflow en `main`. La salida debe mostrar `docker compose ps` y la revisión desplegada. Se puede repetir la comprobación de `https://app.gelaia.com` del paso 4.

La clave de lectura del repositorio y la clave de GitHub Actions cumplen funciones distintas. La segunda solo puede invocar el script de este frontend mediante el comando forzado de SSH.
