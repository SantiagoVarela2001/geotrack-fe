# CONTEXTO_PROYECTO.md

# 1. Objetivo del proyecto

Construir un SaaS B2B para agencias de SEO/marketing que permita monitorear cómo aparecen las marcas de sus clientes en respuestas generadas por motores de IA.

El producto NO intenta reemplazar el SEO tradicional.

El objetivo es resolver un problema nuevo:

> Una empresa puede estar bien posicionada en Google pero no aparecer, aparecer poco o aparecer peor que sus competidores cuando un usuario consulta a ChatGPT, Gemini u otros asistentes de IA.

La plataforma debe permitir que una agencia:

1. cargue a uno de sus clientes;
2. defina marca, web, rubro, país, idioma y competidores;
3. genere consultas relevantes con IA;
4. revise y apruebe esas consultas;
5. ejecute periódicamente esas consultas contra distintos proveedores;
6. guarde las respuestas originales;
7. normalice las respuestas a datos estructurados;
8. calcule métricas comparables;
9. mantenga histórico;
10. detecte oportunidades y cambios;
11. genere recomendaciones accionables usando IA;
12. permita registrar cuándo una recomendación fue implementada;
13. muestre qué ocurrió después de la implementación sin afirmar causalidad directa.

El valor del producto no está en “preguntarle cosas a GPT”.

El valor está en:

- histórico;
- monitoreo recurrente;
- comparación contra competidores;
- normalización de múltiples proveedores;
- métricas consistentes;
- evidencia;
- recomendaciones accionables;
- seguimiento temporal;
- dataset acumulado.

---

# 2. Regla obligatoria de idioma del código

TODO el código del proyecto debe estar escrito en español, salvo nombres propios de tecnologías, proveedores o estándares.

Esto incluye:

- nombres de clases;
- nombres de entidades;
- nombres de métodos;
- nombres de variables;
- nombres de paquetes;
- nombres de DTOs;
- nombres de servicios;
- nombres de repositorios;
- nombres de controladores;
- nombres de enums;
- valores de enums;
- endpoints REST;
- tablas;
- columnas;
- constraints;
- índices;
- mensajes de validación;
- excepciones propias;
- nombres de migraciones cuando sea razonable.

Ejemplo correcto:

```java
public class ClienteMonitoreado {
    private UUID id;
    private String nombreMarca;
    private EstadoCliente estado;
}
```

Ejemplo incorrecto:

```java
public class MonitoredClient {
    private UUID id;
    private String brandName;
    private ClientStatus status;
}
```

Ejemplos de paquetes:

```text
organizacion
usuario
cliente
competidor
tema
consulta
monitoreo
proveedor
extraccion
metrica
recomendacion
historial
consumo
compartido
```

Ejemplos de endpoints:

```text
/api/organizaciones
/api/clientes-monitoreados
/api/consultas
/api/recomendaciones
```

No traducir nombres propios como:

- OpenAI;
- Gemini;
- PostgreSQL;
- Spring Boot;
- Flyway;
- Hibernate;
- JSON;
- HTTP;
- UUID.

---

# 3. Cliente objetivo

## Cliente directo

Agencias de:

- SEO;
- marketing digital;
- performance;
- desarrollo web;
- consultoría digital.

La agencia paga por usar la plataforma.

## Cliente monitoreado

Cada agencia administra múltiples empresas.

Ejemplo:

Agencia:
`Pepito SEO`

Clientes monitoreados:

- Clínica Dental Pérez
- Taller Mecánico López
- Estudio Jurídico Gómez
- SaaS X

Cada cliente monitoreado consume un cupo del plan de la agencia.

---

# 4. Modelo comercial pensado

La unidad de negocio principal es:

> cliente monitoreado activo

No se cobra por tokens ni por cantidad de solicitudes visibles al usuario.

Inicialmente se pueden vender paquetes:

- hasta 3 clientes;
- hasta 10 clientes;
- hasta 20 clientes.

Más adelante se puede pasar a precio por cliente activo.

Un cliente archivado:

- conserva histórico;
- deja de ejecutarse;
- no consume monitoreo;
- no consume cupo activo.

La plataforma debe poder soportar ambos modelos sin rediseñar el dominio.

---

# 5. Conceptos principales del dominio

## Organizacion

Representa a la agencia.

Es el tenant principal del sistema.

Toda información de negocio debe quedar asociada directa o indirectamente a una organización.

## Usuario

Cuenta que ingresa a la plataforma. Las cuentas de tipo `ORGANIZACION` pertenecen a una sola agencia e ingresarán con su correo electrónico. Las cuentas de tipo `PLATAFORMA` no pertenecen a una organización; inicialmente solo existe `sysadmin`. Ambos tipos comparten credenciales, roles, permisos y sesiones en el mismo modelo persistente.

Roles iniciales:

```java
PROPIETARIO
MIEMBRO
SYSADMIN
```

No implementar permisos complejos en el MVP salvo que sean necesarios.

## ClienteMonitoreado

Empresa que la agencia monitorea.

Datos principales:

- nombre;
- nombre de marca;
- sitio web;
- descripción;
- industria/rubro;
- país;
- idioma;
- estado;
- fecha de creación.

Estados iniciales:

```java
ACTIVO
ARCHIVADO
```

## Competidor

Competidor definido para un cliente monitoreado.

Debe estar vinculado a un único `ClienteMonitoreado`.

## Tema

Agrupa consultas semánticamente relacionadas.

Ejemplo:

Tema:
`Gestión de talleres`

Consultas:

- “mejor software para talleres mecánicos”
- “programa para administrar un taller”
- “sistema de gestión para mecánicos”

Los temas permiten analizar resultados por asunto sin depender de una frase exacta.

Un cliente no puede tener dos temas activos con el mismo nombre, sin distinguir mayúsculas ni espacios al principio o al final. El nombre queda disponible otra vez después de la baja lógica del tema. Un tema activo puede renombrarse y conserva quién lo editó.

Los temas de un cliente `ARCHIVADO` siguen disponibles para lectura, pero no pueden crearse ni renombrarse hasta que el cliente vuelva a estar activo. SYSADMIN puede leer los temas de cualquier organización; la creación y edición pertenecen a cuentas de la organización dueña del cliente.

## Consulta

Consulta que será ejecutada contra motores de IA.

Es el equivalente de lo que comercialmente suele llamarse “prompt”, pero dentro del código se utilizará el término `Consulta`.

Campos relevantes:

- texto;
- tema;
- prioridad;
- estado;
- frecuencia;
- próxima ejecución;
- fecha de creación.

El alta manual recibe un array JSON no vacío y devuelve un array con las consultas creadas en `BORRADOR`, conservando el usuario creador. Cada cliente monitoreado puede tener hasta 15 consultas activas en total, sumando todos sus temas; una baja lógica libera un lugar. Antes de crear, la API bloquea el cliente y comprueba que la cantidad existente más el lote no supere ese cupo, incluso con altas simultáneas en distintos temas. La tanda se valida y guarda completa en una sola transacción: si alguna consulta falla o no hay cupo suficiente, ninguna se guarda y se debe corregir y reenviar todo el lote. Dentro de un tema no se puede crear otra consulta activa con el mismo texto y tipo, ni repetir esa combinación dentro del lote; se ignoran mayúsculas y espacios exteriores, y la prioridad no distingue duplicados. El mismo texto puede existir con otro tipo o en otro tema. La API comprueba los duplicados con una búsqueda en el repositorio mientras bloquea el tema. Una carga directa en la base de datos no pasa por las comprobaciones de la API.

La baja de consultas usa `POST /api/clientes-monitoreados/{clienteUuid}/consultas/bajas` con un array JSON no vacío de UUID, incluso si pertenecen a distintos temas del cliente. Exige `CONSULTAS_ELIMINAR`, una cuenta de la organización propietaria y un cliente activo. Valida todos los UUID antes de cambiar registros: uno inexistente, ya inactivo o ajeno al cliente rechaza el lote entero. Los UUID repetidos también se rechazan. En éxito devuelve `204`; las filas permanecen para el histórico con estado inactivo, fecha de eliminación y usuario eliminador.

La aprobación usa `POST /api/clientes-monitoreados/{clienteUuid}/consultas/aprobaciones` con un array JSON no vacío de UUID de cualquier tema del cliente. Exige `CONSULTAS_APROBAR` y una cuenta de la organización propietaria. Solo admite consultas activas en `BORRADOR`, de temas activos y de un cliente activo. Se comprueba toda la tanda antes de cambiar estados: un UUID inexistente, ajeno, inactivo, repetido o ya aprobado rechaza el lote completo. En éxito devuelve `200` con un array de `DatosConsulta` de las consultas aprobadas en esa solicitud, en el mismo orden de los UUID recibidos y con el formato usado por las rutas de lectura. Cambia el estado a `APROBADA` y registra el usuario editor y la fecha de modificación. El tipo `REFERENCIA` o `DESCUBRIMIENTO` permanece igual.

Las consultas de clientes `ARCHIVADO` siguen visibles, pero no se pueden crear ni aprobar otras hasta que el cliente vuelva a estar activo. SYSADMIN puede leer las consultas de cualquier organización; las cuentas de la organización dueña pueden crearlas y aprobarlas si tienen el permiso correspondiente.

Tipos conceptuales:

### REFERENCIA

Consultas del conjunto estable de comparación. Pueden aprobarse y ejecutarse sin perder su tipo.

Sirven para mantener comparabilidad histórica.

Su contenido no se edita. Para cambiar texto, tipo, tema o prioridad, se da de baja lógicamente la consulta anterior y se crea otra. Las mediciones anteriores conservan su consulta original.

### DESCUBRIMIENTO

Consultas rotativas, creadas manualmente o sugeridas por IA.

No deben alterar retrospectivamente las métricas históricas.

Pueden aprobarse y ejecutarse sin convertirse automáticamente en `REFERENCIA`. Para rotarlas, se da de baja lógicamente una consulta y se crea otra; para incorporar una al conjunto de referencia, se crea una nueva consulta de ese tipo. La aprobación y el tipo son decisiones independientes.

La frecuencia y la próxima ejecución se configurarán al incorporar el monitoreo programado; el alta manual inicial no presupone una cadencia.

## EjecucionConsulta

Representa una ejecución real de una consulta contra un proveedor.

Debe guardar SIEMPRE:

- consulta;
- texto, tipo y tema usados en esa ejecución para conservar el contexto histórico;
- proveedor;
- modelo;
- fecha;
- respuesta cruda;
- duración;
- tokens de entrada;
- tokens de salida;
- cantidad de búsquedas si aplica;
- costo;
- estado;
- error si ocurrió.

Nunca descartar la respuesta cruda.

## ResultadoEjecucion

Resultado normalizado de una ejecución.

La normalización puede ser realizada con IA.

Debe contener información estructurada como:

- marca mencionada;
- posición/prominencia;
- competidores mencionados;
- citas;
- dominios;
- metadata útil.

## MencionCompetidor

Representa la aparición de un competidor dentro de un `ResultadoEjecucion`.

## CitaFuente

Fuente citada por el motor.

Campos:

- URL;
- dominio;
- tipo si aplica;
- referencia al `ResultadoEjecucion`.

## InstantaneaMetrica

Snapshot temporal de métricas.

Ejemplos:

- tasa de presencia;
- tasa de citas;
- posición promedio;
- presencia por proveedor;
- presencia por tema;
- brecha contra competidores;
- medias móviles.

Las métricas deben salir de datos estructurados.

No deben ser inventadas por IA.

## Recomendacion

Recomendación generada con IA a partir de evidencia real.

Debe incluir:

- tipo;
- título;
- explicación;
- evidencia;
- tema relacionado;
- acciones sugeridas;
- estado;
- fecha de generación;
- fecha de implementación si aplica.

Estados iniciales:

```java
NUEVA
EN_PROGRESO
IMPLEMENTADA
DESCARTADA
```

Una recomendación no debe ser solo texto libre.

Debe ser una entidad persistida y trazable.

## EventoHistorial

Evento visible en el histórico del cliente.

Ejemplos:

- monitoreo iniciado;
- consulta agregada;
- nueva recomendación;
- recomendación implementada;
- nueva cita detectada;
- cambio relevante;
- competidor agregado.

## ConsumoIA

Registro interno de consumo.

Debe permitir saber cuánto cuesta cada:

- organización;
- cliente monitoreado;
- proveedor;
- modelo;
- operación;
- período.

Esto es obligatorio desde el MVP.

---

# 6. Flujo principal del producto

## Paso 1 — Alta del cliente

La agencia crea un cliente monitoreado.

Carga:

- marca;
- URL;
- descripción;
- rubro;
- país;
- idioma;
- competidores.

## Paso 2 — Generación de consultas

Una IA analiza el contexto y propone consultas relevantes.

Debe devolver una estructura controlada.

Ejemplo conceptual:

```json
{
  "texto": "qué software me recomendás para administrar un taller",
  "tema": "GESTION_TALLER",
  "prioridad": "ALTA"
}
```

## Paso 3 — Validación humana

El usuario puede:

- aprobar;
- dar de baja lógicamente;
- agregar consultas;
- reemplazar una consulta con otra si necesita cambiar texto, tipo, tema o prioridad.

Las consultas aprobadas quedan listas para el monitoreo, conservando su tipo `REFERENCIA` o `DESCUBRIMIENTO`.

## Paso 4 — Monitoreo

Las consultas se ejecutan contra proveedores.

Proveedores iniciales:

- OpenAI;
- Gemini.

Perplexity y otros quedan fuera del MVP.

## Paso 5 — Persistencia cruda

Guardar la respuesta original antes de cualquier procesamiento.

## Paso 6 — Normalización

Una IA transforma la respuesta a un esquema interno.

Ejemplo conceptual:

```json
{
  "marcaMencionada": true,
  "posicionMarca": 2,
  "competidores": [
    {
      "nombre": "Competidor X",
      "mencionado": true,
      "posicion": 1
    }
  ],
  "citas": [
    {
      "dominio": "ejemplo.com",
      "url": "https://ejemplo.com/articulo"
    }
  ]
}
```

## Paso 7 — Métricas

Java calcula métricas a partir del JSON normalizado.

Ejemplo:

20 consultas medidas.

La marca apareció en 7.

Tasa de presencia:

```text
7 / 20 = 35%
```

Métricas iniciales:

- tasa de presencia;
- tasa de citas;
- posición promedio;
- presencia por proveedor;
- presencia por tema;
- presencia de competidores;
- brecha contra competidores;
- consultas ganadas/perdidas;
- tendencia de 7 días;
- tendencia de 30 días.

Evitar scores artificiales tipo “GEO Score 82/100” salvo que exista una definición clara y auditable.

## Paso 8 — Histórico

Las métricas se guardan y muestran temporalmente.

La plataforma debe priorizar tendencias y ventanas móviles sobre comparaciones aisladas de “hoy vs ayer”.

## Paso 9 — Recomendaciones

Una IA recibe:

- contexto del cliente;
- consultas;
- temas;
- respuestas;
- métricas;
- competidores;
- citas;
- páginas relevantes si están disponibles.

Debe devolver recomendaciones estructuradas basadas en evidencia.

No generar recomendaciones genéricas sin evidencia.

Ejemplo:

```json
{
  "tipo": "BRECHA_CONTENIDO",
  "titulo": "Crear una página específica sobre historial de mantenimiento",
  "motivo": "Los competidores aparecen con mayor frecuencia en consultas relacionadas...",
  "temaId": "...",
  "evidencia": {
    "presenciaCliente": 0.20,
    "presenciaCompetidor": 0.70
  },
  "accionesSugeridas": [
    "crear una landing específica",
    "agregar preguntas frecuentes",
    "explicar beneficios concretos"
  ]
}
```

## Paso 10 — Implementación

El usuario puede marcar una recomendación como `IMPLEMENTADA`.

Guardar:

- `fechaImplementacion`;
- comentario opcional;
- URL opcional.

## Paso 11 — Seguimiento posterior

NO afirmar causalidad.

Mostrar:

- qué métricas había antes;
- qué pasó después;
- qué consultas/temas cambiaron;
- qué citas aparecieron;
- qué tendencias surgieron.

Frases aceptables:

- “Se observa una mejora posterior a la implementación.”
- “Se detecta una señal positiva.”
- “Todavía no hay evidencia suficiente.”

Frases no aceptables:

- “Esta recomendación causó un aumento del 25%.”

---

# 7. Frecuencia de monitoreo

El producto debe sentirse activo.

No diseñarlo como un informe mensual.

Modelo inicial:

- consultas prioritarias: ejecución frecuente;
- consultas secundarias: rotación;
- OpenAI: proveedor principal;
- Gemini: proveedor de contraste.

La frecuencia debe ser configurable por `Consulta`.

Cada consulta debe tener:

```java
frecuencia
proximaEjecucion
```

No crear un `@Scheduled` por consulta.

Debe existir un worker que periódicamente busque:

```sql
WHERE proxima_ejecucion <= now()
```

y ejecute las consultas pendientes.

Más adelante, para múltiples instancias, se podrá utilizar:

```sql
FOR UPDATE SKIP LOCKED
```

No introducir Kafka en MVP.

---

# 8. Detección de cambios

No usar umbrales universales arbitrarios como:

```java
cambioVisibilidad > 5
```

La relevancia depende del número de consultas y del comportamiento habitual del cliente.

Inicialmente comparar ventanas.

Ejemplo:

- media últimos 7 días;
- media 7 días anteriores;
- cantidad de consultas afectadas;
- persistencia;
- cantidad de proveedores donde se observa el mismo patrón.

No afirmar “significancia estadística” salvo que exista un modelo estadístico real.

Usar conceptos más simples:

```java
DEBIL
MODERADA
FUERTE
```

Esta funcionalidad puede evolucionar después del MVP.

---

# 9. Arquitectura backend

Stack objetivo:

- Java 21;
- Spring Boot;
- PostgreSQL;
- Flyway;
- JPA/Hibernate;
- API REST.

Arquitectura:

> Monolito modular

No microservicios en MVP.

Preferir paquetes por funcionalidad.

Ejemplo:

```text
com.empresa.geo

organizacion/
usuario/
cliente/
competidor/
tema/
consulta/
monitoreo/
proveedor/
  openai/
  gemini/
extraccion/
metrica/
recomendacion/
historial/
consumo/
compartido/
```

Evitar una estructura global basada únicamente en:

```text
controlador/
servicio/
repositorio/
entidad/
dto/
```

Cada funcionalidad debe contener internamente sus propias capas.

Ejemplo:

```text
consulta/

Consulta.java
RepositorioConsulta.java
ServicioConsulta.java
ControladorConsulta.java
GeneradorConsultas.java
SolicitudGeneracionConsultas.java
RespuestaConsulta.java
```

---

# 10. Base de datos conceptual

Entidades principales:

```text
Organizacion
  ├── Usuario
  └── ClienteMonitoreado
        ├── Competidor
        ├── Tema
        │     └── Consulta
        │            └── EjecucionConsulta
        │                   └── ResultadoEjecucion
        │                          ├── MencionCompetidor
        │                          └── CitaFuente
        │
        ├── InstantaneaMetrica
        ├── Recomendacion
        ├── EventoHistorial
        └── ConsumoIA
```

Relaciones clave:

- `Organizacion 1:N Usuario`
- `Organizacion 1:N ClienteMonitoreado`
- `ClienteMonitoreado 1:N Competidor`
- `ClienteMonitoreado 1:N Tema`
- `Tema 1:N Consulta`
- `Consulta 1:N EjecucionConsulta`
- `EjecucionConsulta 1:1 ResultadoEjecucion`
- `ResultadoEjecucion 1:N CitaFuente`
- `ResultadoEjecucion 1:N MencionCompetidor`
- `ClienteMonitoreado 1:N InstantaneaMetrica`
- `ClienteMonitoreado 1:N Recomendacion`
- `ClienteMonitoreado 1:N EventoHistorial`
- `Organizacion 1:N ConsumoIA`
- `ClienteMonitoreado 1:N ConsumoIA`

Nombres orientativos de tablas:

```text
organizaciones
usuarios
clientes_monitoreados
competidores
temas
consultas
ejecuciones_consulta
resultados_ejecucion
menciones_competidor
citas_fuente
instantaneas_metrica
recomendaciones
eventos_historial
consumos_ia
```

---

# 11. MVP vendible

El MVP debe permitir:

- crear organización;
- crear usuario;
- crear cliente monitoreado;
- definir competidores;
- crear temas;
- generar consultas con IA;
- dar de baja y reemplazar consultas;
- aprobar consultas;
- ejecutar consultas contra OpenAI;
- ejecutar consultas contra Gemini;
- persistir respuestas crudas;
- normalizar respuestas;
- persistir citas;
- persistir menciones de competidores;
- calcular métricas;
- mostrar histórico;
- generar recomendaciones;
- marcar recomendación como implementada;
- mostrar historial básico;
- registrar costo de cada operación de IA;
- archivar/reactivar clientes;
- limitar cantidad de clientes activos por organización.

Con esto el producto puede empezar a validarse comercialmente.

---

# 12. Fuera del MVP

No implementar salvo decisión explícita:

- microservicios;
- Kafka;
- RabbitMQ;
- base vectorial;
- embeddings;
- RAG complejo;
- crawler masivo;
- scraping indiscriminado;
- Perplexity;
- Claude;
- Copilot;
- Search Console;
- Google Analytics;
- integración WordPress;
- Webflow;
- Shopify;
- Stripe;
- Mercado Pago;
- PDFs complejos;
- white-label avanzado;
- sistema avanzado de permisos;
- emails automáticos sofisticados;
- API pública;
- webhooks;
- generación automática de PRs;
- modificación automática de sitios;
- causalidad automática de recomendaciones;
- machine learning propio.

Estas funcionalidades pueden agregarse luego si existe demanda real.

---

# 13. Escalabilidad futura

La evolución pensada es:

## V1
Monitor GEO funcional.

## V2
Reportes white-label para agencias.

## V3
Más proveedores de IA.

## V4
Crawler del sitio del cliente.

## V5
Integraciones con Search Console y Analytics.

## V6
Mejor motor de recomendaciones basado en histórico.

## V7
Generación asistida de contenido.

## V8
Integraciones con CMS.

## V9
Aplicación automática de algunas recomendaciones.

## V10
Plataforma GEO completa.

La arquitectura actual debe permitir evolucionar, pero NO debe implementar anticipadamente estas versiones.

---

# 14. Principios técnicos

## Mantener simplicidad

Elegir la solución más simple que cubra la necesidad actual.

## Persistir datos importantes

Nunca descartar:

- respuestas crudas;
- costos;
- timestamps;
- modelo utilizado;
- proveedor;
- resultados normalizados.

## Trazabilidad

Una métrica debe poder explicarse a partir de datos persistidos.

Una recomendación debe poder mostrar evidencia.

## Idempotencia

Los trabajos y procesos automáticos deben diseñarse considerando reintentos.

## Multi-tenancy

Nunca devolver información de otra `Organizacion`.

Todas las consultas del dominio deben respetar el tenant.

## Conciencia de costos

Toda llamada a un proveedor de IA debe quedar registrada en `ConsumoIA`.

## No sobrediseñar

No introducir patrones complejos sin una necesidad demostrable.

---

# 15. Principios de producto

## No vender humo

No afirmar que se mide exactamente “el ranking oficial de ChatGPT”.

La plataforma mide respuestas obtenidas mediante los proveedores integrados y bajo condiciones conocidas.

## No inventar certeza

Las respuestas generativas tienen variabilidad.

Mostrar tendencias y evidencia, no falsas certezas.

## El usuario mantiene control

La IA puede sugerir consultas y recomendaciones.

El usuario valida.

## Las recomendaciones deben ser accionables

Evitar recomendaciones como:

- “mejorar autoridad”;
- “optimizar contenido”;
- “hacer mejor SEO”.

Preferir:

- qué hacer;
- por qué;
- qué evidencia lo sostiene;
- sobre qué tema;
- qué competidores están involucrados.

---

# 16. Forma de trabajo con el agente

El agente NO debe desarrollar el proyecto completo de una vez.

Debe trabajar funcionalidad por funcionalidad.

Cada funcionalidad debe ser una vertical slice completa.

Ejemplo correcto:

```text
crear cliente
→ persistir
→ endpoint
→ validaciones
→ tests
→ poder consultarlo
```

Ejemplo incorrecto:

```text
crear todas las entidades del proyecto
→ crear todos los repositorios
→ crear todos los servicios
→ crear todos los controladores
```

Antes de implementar una funcionalidad, el agente debe:

1. leer este documento;
2. revisar el código existente;
3. describir brevemente qué va a cambiar;
4. identificar decisiones de dominio que ya existen;
5. evitar cambiar decisiones fuera del alcance.

Durante la implementación:

- modificar solo lo necesario;
- respetar convenciones existentes;
- escribir código en español;
- agregar migraciones Flyway cuando corresponda;
- agregar validaciones;
- agregar tests relevantes;
- no introducir dependencias innecesarias;
- no crear abstracciones “por si acaso”.

Después de implementar:

- resumir cambios;
- indicar endpoints nuevos;
- indicar migraciones;
- indicar tests creados;
- indicar decisiones tomadas;
- mencionar cualquier deuda técnica introducida.

---

# 17. Regla para decisiones no definidas

Si una decisión importante de producto no está definida en este documento ni en el pedido específico de la funcionalidad:

> NO inventarla silenciosamente.

El agente debe elegir la alternativa más simple y dejar explícito qué supuesto tomó.

No debe expandir el alcance sin autorización.

Ejemplos:

- agregar Redis sin necesidad;
- introducir eventos de dominio complejos;
- incorporar CQRS;
- cambiar PostgreSQL;
- crear un microservicio;
- añadir OAuth;
- incorporar un tercer proveedor de IA.

---

# 18. Definición de terminado por funcionalidad

Una funcionalidad se considera terminada cuando:

- cumple el caso de uso;
- persiste correctamente;
- respeta multi-tenancy;
- tiene validaciones;
- maneja errores principales;
- posee migración si cambia DB;
- tiene tests relevantes;
- no rompe tests existentes;
- expone una API coherente;
- puede probarse de punta a punta;
- no introduce funcionalidades no solicitadas;
- mantiene nombres de código en español.

---

# 19. Orden recomendado de implementación

## Funcionalidad 1
`Organizacion + ClienteMonitoreado + Competidor`

Objetivo:

poder crear y consultar un cliente completo.

## Funcionalidad 2
`Tema + Consulta`

Objetivo:

poder administrar manualmente consultas.

## Funcionalidad 3
Generación de consultas con IA.

Objetivo:

generar sugerencias y permitir aprobación.

## Funcionalidad 4
Monitoreo con OpenAI.

Objetivo:

ejecutar una consulta y guardar respuesta cruda + costo.

## Funcionalidad 5
Normalización.

Objetivo:

convertir respuesta cruda en `ResultadoEjecucion`.

## Funcionalidad 6
Métricas básicas.

Objetivo:

mostrar tasa de presencia, tasa de citas y competidores.

## Funcionalidad 7
Planificador de ejecuciones.

Objetivo:

automatizar ejecuciones.

## Funcionalidad 8
Gemini.

Objetivo:

incorporar un segundo proveedor.

## Funcionalidad 9
Histórico.

Objetivo:

tendencias e instantáneas.

## Funcionalidad 10
Recomendaciones.

Objetivo:

generar acciones basadas en evidencia.

## Funcionalidad 11
Estados de recomendaciones + historial.

Objetivo:

registrar implementaciones y observar evolución posterior.

## Funcionalidad 12
Suscripción/cupos.

Objetivo:

limitar cantidad de clientes activos.

---

# 20. Objetivo actual

El objetivo inmediato NO es construir una plataforma completa.

El objetivo es llegar lo antes posible a este flujo funcionando:

```text
crear cliente
↓
generar consultas
↓
aprobar consultas
↓
ejecutar en OpenAI
↓
guardar respuesta
↓
normalizar
↓
calcular tasa de presencia
↓
mostrar resultado
```

Ese es el primer circuito de valor real.

Una vez que ese circuito sea estable, extenderlo progresivamente.

---

# 21. Glosario de nombres de código

Para evitar que distintas funcionalidades terminen usando nombres diferentes para el mismo concepto:

| Concepto de producto | Nombre en código |
|---|---|
| Agencia / tenant | `Organizacion` |
| Usuario | `Usuario` |
| Cliente de la agencia | `ClienteMonitoreado` |
| Competidor | `Competidor` |
| Cluster / topic | `Tema` |
| Prompt | `Consulta` |
| Prompt benchmark | `Consulta` de tipo `REFERENCIA` |
| Prompt discovery | `Consulta` de tipo `DESCUBRIMIENTO` |
| Prompt execution | `EjecucionConsulta` |
| Normalized result | `ResultadoEjecucion` |
| Competitor mention | `MencionCompetidor` |
| Citation | `CitaFuente` |
| Metric snapshot | `InstantaneaMetrica` |
| Recommendation | `Recomendacion` |
| Timeline event | `EventoHistorial` |
| AI usage | `ConsumoIA` |

Este glosario se considera parte de las reglas del proyecto y debe respetarse en nuevas funcionalidades.
