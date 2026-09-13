# Reglas de Proyecto: Plataforma Web CASE UML Colaborativa (UAGRM - SW1)

## 1. Gestión de Reportes de Fase
- Al concluir cada fase del desarrollo, generar el reporte técnico formal y guardarlo ÚNICAMENTE en la carpeta:
  `REPORTE-FASES-FIN/FASE-<N>-REPORTE.md`
- No guardar reportes en la raíz del proyecto.

## 2. Shell y Comandos (Windows PowerShell)
- La terminal utilizada es Windows PowerShell.
- Utilizar `;` para encadenar comandos en lugar de `&&`.

## 3. Base de Datos PostgreSQL
- Motor: PostgreSQL 17 local (`localhost:5432`).
- Base de datos: `case_collaborative_db`.
- Credenciales: Leídas exclusivamente desde `server/.env`.
- En Node.js (`pg`), siempre registrar el parser `types.setTypeParser(20, (val) => parseInt(val, 10))` para evitar conflictos de tipo con columnas `BIGINT`/`BIGSERIAL`.

## 4. Metodología y Fases
- Seguir fielmente la especificación PUDS de 12 fases detallada en la carpeta `promts/`.
- Mantener el 100% de tests aprobados y compilación limpia (`tsc`) al cerrar cada fase.

## 5. Concurrencia y Exclusión Mutua Distribuida (Fase 5)
- **Garantía Anti Auto-bloqueo (Zero Self-Lockout):** Al evaluar bloqueos de nodos (`activeLocks`), verificar siempre tanto el ID de usuario como el nombre de usuario (`userName`). Un usuario NUNCA debe ser bloqueado por su propio lock.
- **Arrendamiento Corto (Lease):** El TTL de los locks en memoria y en PostgreSQL no debe superar 5 segundos (`5000ms`), renovándose activamente mediante latidos periódicos (`heartbeat` cada 2 segundos).
- **Liberación Inmediata al Cambiar de Foco:** Al deseleccionar un nodo o seleccionar otro diferente, liberar inmediatamente el lock anterior mediante WebSocket (`node:release`).
- **Resiliencia Cliente-Servidor:** Si la llamada a la API o WebSocket sufre latencia, el estado local debe mantener una versión optimista operativa sin congelar la interfaz.

## 6. Principios de UX/UI en el Lienzo UML
- **Triple Vía de Eliminación:** Toda entidad/relación debe poder ser eliminada por:
  1. Botón visible directo en la cabecera de la tarjeta del nodo.
  2. Atajo de teclado global (`Delete` o `Backspace`), ignorando inputs de texto.
  3. Botón destructivo en el panel Inspector lateral.
- **Gestión Directa de Relaciones y Cardinalidades:** El Inspector de una clase seleccionada debe listar sus relaciones activas y ofrecer un formulario para asignar nuevas relaciones y cardinalidades (`1..1`, `0..1`, `1..*`, `0..*`) sin forzar micro-interacciones sobre trazos SVG del lienzo.
- **Contraste Visual en Conectores:** Las etiquetas de cardinalidad en SVG deben renderizarse dentro de contenedores o insignias (`<rect>`) de alto contraste para garantizar su legibilidad sobre la cuadrícula.

