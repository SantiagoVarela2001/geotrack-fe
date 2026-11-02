# Validación F02

Implementación del 1 de noviembre de 2026. Referencia: contratos de la solicitud y `../geotrack/docs/CONTRATO_FRONTEND.md`, leídos sin modificar el backend.

La clasificación es un booleano obligatorio e independiente del tipo de consulta y de las menciones en las respuestas. El alta exige una elección sin valor predeterminado. Las correcciones de borradores y aprobadas usan `PATCH /marca` con `CONSULTAS_EDITAR`; SYSADMIN conserva lectura. La edición completa continúa limitada a borradores.

Las escrituras se reflejan tras la confirmación de la API, actualizando por UUID la vista del tema, la agrupación y la generación finalizada. Se conserva `ejecucionHoy` y se invalidan lecturas pendientes tras editar o corregir marca. No se reclasifican mediciones históricas ni se aplica el mínimo de generación a operaciones manuales.

Métricas, exploración diaria y PDF separan los dos grupos. La lectura del período trae ambos en una sola petición. La competencia diaria se consulta al explorar un día, compartiendo una petición y su resultado para ambos grupos. Las tasas del backend se conservan, incluyendo la diferencia entre `null` y cero. Los gráficos de conteos alinean los días; no calculan tasas ni promedios entre grupos. El ranking histórico conserva consultas que aparecen en ambos grupos y sus totales se toman de cada bloque.

Los informes semanales reconocen ambos formatos en último resultado, detalle e historial, incluso después de reintentos. Los formatos incompletos o desconocidos muestran un error, sin completar grupos. Las referencias abren la ejecución por su UUID, sin requerir que siga activa la consulta original.

## Comandos y resultados

| Comando en Windows | Resultado final |
| --- | --- |
| `pnpm.cmd test` | 30 pruebas aprobadas; 0 fallidas y 0 omitidas. Incluye 8 recorridos de navegador y su contenedor. |
| `pnpm.cmd typecheck` | Correcto: `tsc -b --pretty false`. |
| `pnpm.cmd lint` | Correcto, sin advertencias. |
| `pnpm.cmd build` | Correcto: TypeScript y compilación de producción Vite. |
| `git diff --check` | Sin errores de espacios. Git informa únicamente su normalización LF/CRLF configurada. |

Entorno: Node.js 24.13.0 y Microsoft Edge. Las pruebas usan una API simulada, incluidos errores y procesos, sobre una compilación de producción; no crean ni modifican registros del backend real. La configuración de proxy y autenticación de la aplicación se conserva.

El sandbox restringido de Windows produjo fallos de inicio de Edge con `ACCESS_DENIED` en los procesos gráficos. La ejecución final completa se realizó fuera del sandbox y pasó. El cargador CDP espera el documento correcto antes de interactuar y comunica los cierres del navegador.

Se revisaron capturas de métricas en escritorio (1280 px) y móvil (390 px), y se verificó que la página móvil no tenga desbordamiento horizontal. La compilación, capturas y perfiles temporales de las pruebas se ubican bajo `node_modules/.tmp`, fuera del código versionado. Los perfiles se eliminan al cerrar la prueba.

## Cobertura

- Altas y ediciones con `true` y `false`; serialización JSON sin pérdida de `false` y rechazo de ausencia, `null`, strings y números.
- Corrección de aprobadas mediante PATCH, permisos de miembro/propietario, SYSADMIN de solo lectura, permiso de tipo insuficiente y cliente archivado.
- Errores 400, 401, 403, 404 y 409; renovación de sesión y exposición de `detail`; rechazo de marca sin cambio visual y edición fallida conservando el formulario.
- Reemplazo por UUID, movimiento de tema, conservación de `ejecucionHoy` y actualización de la generación finalizada.
- Recuperación y polling de generación, conservación de la clasificación recibida, carga inicial conjunta y detención del polling al finalizar.
- 25 % sin marca y 100 % con marca separados, también en PDF; una lectura inicial y una petición compartida de competencia diaria.
- Ausencia de muestra frente a 0 %, grupos vacíos, conteos pendientes/fallidos/cancelados, días diferentes y una consulta histórica en ambos rankings.
- Informes nuevos, anteriores, nulos, incompletos y con un grupo sin muestra; ocho hallazgos y cinco recomendaciones sin truncar por grupo.
- Último informe, historial, detalle, apertura de evidencias y reintento de contexto anterior con polling sin forzar el formato nuevo.

## Archivos modificados

- `src/api/tipos.ts`, `src/api/clienteApi.ts`: DTO, solicitudes y PATCH de marca.
- `src/componentes/DetalleCliente.tsx`, `src/componentes/EditarConsulta.tsx`, `src/componentes/FilaConsulta.tsx`, `src/componentes/VistaConsultasAgrupadas.tsx`: formularios, etiquetas, permisos y sincronización.
- `src/componentes/MetricasCliente.tsx`, `src/componentes/GraficoEvolucionDiaria.tsx`, `src/componentes/InformeMetricas.tsx`: métricas por grupo, exploración diaria y PDF.
- `src/componentes/AnalisisSemanalesCliente.tsx`: renderizado compatible y referencias de evidencia.
- `src/App.tsx`, `src/componentes/DetalleEjecucionConsulta.tsx`: ruta de evidencia por UUID y clasificación actual claramente distinguida de la histórica.
- `src/App.css`: estilos de clasificación y grupos.
- `package.json`: comandos de pruebas y comprobación de tipos, sin agregar dependencias.
- `docs/CONTRATO_FRONTEND.md`, `README.md`: documentación F02 y verificación.

## Archivos nuevos

- `src/consultas.ts`: validación de clasificación, permisos y actualización de consultas.
- `src/metricas.ts`: etiquetas, tasas y alineación de series.
- `src/informesSemanales.ts`: tipos comprobados en ejecución y detección segura de formato.
- `src/componentes/CorregirMarcaConsulta.tsx`: diálogo exclusivo de clasificación.
- `pruebas/consultas.test.mjs`, `pruebas/metricas.test.mjs`, `pruebas/informes.test.mjs`: pruebas HTTP, estado y renderizado.
- `pruebas/interfaz.test.mjs`: recorridos completos de interfaz.
- `pruebas/datos.mjs`, `pruebas/navegador.mjs`: datos de prueba y navegador CDP con perfil temporal.
- `scripts/registrar-pruebas.mjs`, `scripts/cargador-pruebas.mjs`: ejecución de TypeScript/TSX en memoria usando dependencias existentes.
- `docs/VALIDACION_F02.md`: este informe.
