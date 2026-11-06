# Validación de F10: acciones realizadas

## Interfaz acordada

- Botón «Acciones realizadas» junto a «Ver métricas GEO», que navega a la pantalla
  `/clientes/{clienteUuid}/acciones`, con acceso directo y recarga mediante el hash existente.
- Acceso por ícono en el listado de clientes monitoreados, con los mismos permisos;
  conserva lectura en archivados y comparte el estilo de los botones de la ficha.
- Listado con todas las acciones en el orden del backend, sin aplicar el filtro del gráfico;
  las descripciones y enlaces se despliegan desde cada fila.
- Alta y edición en un diálogo; baja con confirmación. Los errores conservan el formulario.
- Gráfico compartido entre Métricas GEO y la pantalla de acciones, con marcadores agrupados
  por fecha y accesibles por clic y teclado. Evolución diaria aparece antes que los resúmenes en métricas.
- Gráfico a todo el ancho, de altura acotada, con leyenda breve y tendencia opcional.
  Resumen compacto del día, detalle secundario desplegable y acciones que se abren al seleccionar un marcador.
- Registro de acciones desde la cabecera de la página y edición/baja desde el historial o el gráfico.
- Las escrituras actualizan tanto el historial completo como los marcadores del período visible.
- Capas de acciones y métricas independientes, sin nuevas dependencias.

## Cobertura automatizada

- `pruebas/acciones.test.mjs`: rutas y métodos, alta, detalle, PUT completo, opcionales nulos,
  DELETE 204, filtros, orden recibido, límites y validaciones, fechas argentinas, permisos,
  plataforma/archivado, agrupación, enlaces y rechazos HTTP.
- `pruebas/metricas.test.mjs`: marcadores agrupados, filtrado por cliente/período,
  acciones sin mediciones, desaparición al mover/eliminar y conservación de curvas y tasas.
- `pruebas/interfaz.test.mjs`: gestión en navegador, conservación ante errores,
  bloqueo de doble envío, lectura sin escrituras, consultas del mismo período,
  selección por teclado, edición de fecha, borrado de opcionales, eliminación,
  reintento sin perder el gráfico y respuestas antiguas de períodos abandonados.
- El navegador de pruebas usa Edge/Chrome mediante CDP y una API simulada exclusivamente
  en las pruebas; la aplicación siempre usa `/api` y la autenticación existente.

## Comandos y resultados

Validación final realizada el 6 de noviembre de 2026:

| Comando | Resultado |
| --- | --- |
| `pnpm.cmd test` | 61 pruebas correctas, 0 fallos y 0 omitidas, incluidas las interacciones en Edge. |
| `pnpm.cmd build` | TypeScript y compilación de producción correctos. |
| `pnpm.cmd lint` | Correcto, sin advertencias del analizador. |
| `git diff --check` | Correcto, sin errores de espacios. |

La primera ejecución del navegador dentro del aislamiento falló al iniciar su proceso gráfico.
Las pruebas finales se ejecutaron con autorización fuera de ese aislamiento, manteniendo el
servidor local, la API de pruebas y el perfil temporal dentro del proyecto.
También se actualizó la expectativa de cantidad de novedades de la prueba de interfaz para
contemplar el catálogo vigente; conserva la verificación de foco, reapertura y vencimiento.

Las capturas de escritorio y móvil se generan en `node_modules/.tmp/f10-marcadores.png`
y `node_modules/.tmp/f10-marcadores-movil.png`. Se revisaron ambas presentaciones;
en móvil el gráfico permite desplazamiento horizontal y ofrece un selector de fechas
con acciones para acceder a ellas también en períodos extensos.
Las capturas de la pantalla de gestión son `node_modules/.tmp/f10-acciones-pagina.png`
y `node_modules/.tmp/f10-acciones-pagina-movil.png`.

## Verificación contra el backend

Pendiente de comprobar en un entorno con sesión autorizada y backend actualizado con V29:
alta, edición, baja lógica, permisos devueltos por `/api/autenticacion/actual` y aislamiento
entre organizaciones. Las pruebas HTTP automatizadas verifican el contrato con respuestas
controladas; no certifican que la migración o las rutas estén desplegadas.
