# Reglas del frontend

- Leer `docs/CONTRATO_FRONTEND.md` antes de implementar una función. `docs/CONTEXTO_PROYECTO.md` describe la visión; no implica que existan endpoints.
- Priorizar seguridad, eficiencia, legibilidad y aislamiento entre organizaciones. Usar únicamente rutas y campos documentados.
- Escribir código, nombres propios del proyecto y textos de interfaz en español, salvo nombres de tecnologías y estándares.
- Tomar permisos de `GET /api/autenticacion/actual`; el backend conserva la decisión final. No guardar JWT ni datos sensibles en `localStorage` o `sessionStorage`.
- Mantener la API bajo el mismo origen mediante proxy en desarrollo y producción. Configurar destinos con variables de entorno, nunca con direcciones fijas en el código de la interfaz.
- Implementar funciones completas y acotadas. Consultar al líder técnico cuando falte un dato o una decisión relevante de producto; no simular resultados ni funciones sin API.
- Documentar con comentarios las funciones cuyo propósito o manejo de errores no resulte evidente al leer su nombre y firma.
