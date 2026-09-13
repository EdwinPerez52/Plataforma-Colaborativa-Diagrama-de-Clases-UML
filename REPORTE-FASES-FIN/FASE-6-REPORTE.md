# Reporte de Fase 6: Asistente Inteligente de Edición por Voz y Lenguaje Natural (CU05)

**Fecha:** 12 de Septiembre de 2026  
**Estado:** ✅ **COMPLETADO (100% Tests Aprobados - Compilación Limpia)**  
**Proyecto:** Plataforma Web Colaborativa CASE UML Asistida por IA  
**Materia:** Ingeniería de Software 1 — UAGRM (FICCT)  
**Metodología:** PUDS (Fase de Elaboración / Ciclo 2)  
**Documento Técnico:** `FASE-6-REPORTE.md`  

---

## 1. Resumen Ejecutivo de la Fase 6

En esta fase se ha desarrollado e integrado el **Asistente Inteligente de Edición por Voz y Lenguaje Natural (CU05)**, permitiendo a los ingenieros de software mutar el metamodelo UML en tiempo real mediante dictado por voz (Web Speech API) o instrucciones textuales en lenguaje natural, garantizando que cada operación se ejecute de forma atómica sobre PostgreSQL 17 y quede registrada con fines de auditoría y trazabilidad en la tabla `auditoria_comandos_ia`.

### Cumplimiento de Restricciones Operativas:
1. **Regla Fundamental:** La IA **no** diseña el modelo completo desde cero ni alucina relaciones arbitrarias; interpreta y ejecuta **exclusivamente mutaciones atómicas solicitadas por el ingeniero** sobre las tablas `uml_clases`, `uml_atributos`, `uml_metodos` y `uml_relaciones`.
2. **Canales de Entrada:**
   * **Voz en Vivo:** Captura y transcripción fonética mediante Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) con acento regional `es-BO`.
   * **Prompt Textual:** Entrada interactiva lateral con sugerencias rápidas contextualizadas.

---

## 2. Mapeo Semántico de Intenciones (NLP Intent Parser)

El motor [`AiNlpService.ts`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/server/src/services/AiNlpService.ts) implementa un analizador semántico que normaliza el lenguaje natural hacia comandos estructurados:

| Intención Reconocida | Patrón de Ejemplo (Voz / Texto) | Mutación Atómica en PostgreSQL |
|---|---|---|
| **`CREAR_CLASE`** | *"Crea la clase Paciente"* | Inserta en `uml_clases` (`nombre = 'Paciente'`, `estereotipo = 'entity'`). |
| **`AGREGAR_ATRIBUTO`** | *"Añade a Paciente el atributo direccion tipo string"* | Localiza `clase_id` de Paciente e inserta en `uml_atributos` (`nombre = 'direccion'`, `tipo_dato = 'String'`). |
| **`AGREGAR_ATRIBUTO [PK]`**| *"Agrega el atributo ci tipo varchar como clave primaria a Paciente"* | Inserta en `uml_atributos` con flag `es_clave_primaria = true`. |
| **`AGREGAR_METODO`** | *"Añade el método calcularEdad a Paciente que retorna int"* | Inserta en `uml_metodos` (`nombre = 'calcularEdad'`, `tipo_retorno = 'Integer'`). |
| **`CREAR_RELACION`** | *"Relaciona Medico con Consulta de 1 a muchos tipo composicion"* | Inserta en `uml_relaciones` con `multiplicidad_origen = '1..1'` y `multiplicidad_destino = '1..*'`. |
| **`ELIMINAR_ATRIBUTO`** | *"Elimina el atributo obsoleto en HistoriaClinica"* | Localiza la entidad y borra la fila correspondiente en `uml_atributos`. |
| **`ELIMINAR_CLASE`** | *"Elimina la clase Temporal"* | Borra en cascada la entidad en `uml_clases`. |
| **`RENOMBRAR_CLASE`** | *"Renombra la clase Paciente a PacienteAmbulatorio"* | Actualiza el nombre en `uml_clases`. |

---

## 3. Trazabilidad y Registro en `auditoria_comandos_ia`

Cada comando procesado (exitoso o fallido) persiste atómicamente en la tabla `auditoria_comandos_ia` con la siguiente estructura relacional:

* `id`: Identificador único de auditoría (BIGSERIAL).
* `proyecto_id`: Referencia foránea al proyecto activo.
* `usuario_id`: Identificador del ingeniero emisor (extraído del token JWT autenticado).
* `canal_entrada`: Origen de la orden (`'VOZ'` o `'TEXTO'`).
* `comando_transcrito`: Texto íntegro capturado del dictado o prompt.
* `intencion_reconocida`: Código de la intención resuelta (`CREAR_CLASE`, `AGREGAR_ATRIBUTO`, etc.).
* `payload_json`: Parámetros estructurados extraídos por el parser NLP.
* `ejecutado_con_exito`: Indicador booleano del resultado de la mutación.
* `creado_en`: Timestamp de auditoría inmutable.

---

## 4. Artefactos Desarrollados y Modificados

```text
server/
├── src/
│   ├── services/
│   │   ├── AiNlpService.ts                # Parser semántico de lenguaje natural y normalización de tipos
│   │   └── AiCommandExecutionService.ts   # Ejecutor de mutaciones atómicas y persistencia en auditoria_comandos_ia
│   ├── controllers/
│   │   └── aiController.ts                # Controlador REST para POST /command y GET /ai-audit
│   ├── routes/
│   │   └── aiRoutes.ts                    # Router Express protegido por JWT authMiddleware
│   ├── server.ts                          # Montaje de /api/v1/ai
│   └── __tests__/
│       └── aiCommandAssistant.test.ts     # Suite de 8 pruebas de NLP, mutación y auditoría

client/
└── src/
    ├── services/
    │   └── api.ts                         # Cliente HTTP con executeAiCommand y getAiAudit
    ├── components/
    │   ├── ai/
    │   │   └── AiAssistantDrawer.tsx      # Drawer lateral con Web Speech API y feed de auditoría en vivo
    │   └── toolbar/
    │       └── CanvasToolbar.tsx          # Botón de acceso rápido al Asistente IA con icono Sparkles
    └── App.tsx                            # Orquestación de comandos IA y refresco del lienzo
```

---

## 5. Resultados del Testing Automatizado y Compilación

### Backend (`server`):
```bash
> case-collaborative-server@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/jospe/Documents/1er Parcial Sw1/server

 ✓ src/__tests__/lockManager.test.ts (7 tests)
 ✓ src/__tests__/diagramManager.test.ts (5 tests)
 ✓ src/__tests__/metamodelPersistence.test.ts (5 tests)
 ✓ src/__tests__/distributedConcurrency.test.ts (6 tests)  # Fase 5: Concurrencia Distribuida
 ✓ src/__tests__/umlAtomicEndpoints.test.ts (11 tests)     # Fase 4: Persistencia Atómica UML
 ✓ src/__tests__/aiCommandAssistant.test.ts (8 tests)      # Fase 6: Asistente IA y Auditoría (CU05)
 ✓ src/__tests__/authAndProjects.test.ts (11 tests)        # Fase 3: Autenticación y Salas
 ✓ src/__tests__/collaborationSocket.test.ts (5 tests)     # Sockets y Colaboración en Tiempo Real

 Test Files  8 passed (8)
      Tests  58 passed (58)
   Duration  2.99s
```

### Frontend (`client`):
```bash
> case-collaborative-client@1.0.0 build
> tsc && vite build

vite v6.4.3 building for production...
transforming...
✓ 1627 modules transformed.
rendering chunks...
dist/index.html                   0.54 kB │ gzip:  0.36 kB
dist/assets/index-BujfRM-S.css   24.82 kB │ gzip:  5.02 kB
dist/assets/index-Bv_JBDQl.js   245.99 kB │ gzip: 75.28 kB
✓ built in 7.72s
```

---

## 6. Cumplimiento de Criterios de Aceptación (Fase 6)

* [x] **Modificación correcta de clases y relaciones mediante órdenes de voz:** Probado funcionalmente mediante Web Speech API y tests automatizados de mutación directa.
* [x] **Trazabilidad completa en `auditoria_comandos_ia`:** Cada orden (exitosa o fallida) registra el canal, usuario, transcripción, intención y payload en PostgreSQL 17.
* [x] **Actualización sin recargar la página:** Las mutaciones atómicas se propagan y actualizan reactivamente el lienzo interactivo.
* [x] **100% de pruebas aprobadas (58/58)** y compilación limpia tanto en `server` (`tsc`) como en `client` (empaquetado Vite).
