# FASE 06: Asistente Inteligente de Edición por Voz y Lenguaje Natural
**Directiva para el Agente:** Implementación de CU05 para mutar atómicamente las tablas `uml_clases`, `uml_atributos` y `uml_relaciones`, registrando cada orden en `auditoria_comandos_ia`.

---

## 1. Restricciones Operativas del Agente IA
* **Regla Fundamental:** La IA **no** diseña el modelo completo desde cero; ejecuta exclusivamente mutaciones atómicas solicitadas por el ingeniero[cite: 7].
* Canales: Dictado por voz (Web Speech API / Whisper) y panel de prompt de texto lateral[cite: 7].

## 2. Mapeo Semántico de Intenciones (NLP Intent Parser)
* `"Crea la clase Paciente"`:
  * Inserta en `uml_clases` (nombre = 'Paciente')[cite: 7].
* `"Añade a Paciente el atributo direccion tipo string"`:
  * Localiza `id` de Paciente en `uml_clases` e inserta en `uml_atributos` (nombre = 'direccion', tipo = 'String')[cite: 7].
* `"Relaciona Medico con Consulta de 1 a muchos"`:
  * Inserta en `uml_relaciones` con `multiplicidad_origen = '1..1'` y `multiplicidad_destino = '1..*'`[cite: 7].
* `"Elimina el atributo obsoleto en HistoriaClinica"`:
  * Borra la fila correspondiente en `uml_atributos`[cite: 7].

## 3. Tareas Técnicas para el Agente
1. Desarrollar el módulo de extracción de intenciones y entidades usando modelos NLP estructurados.
2. Insertar cada comando en `auditoria_comandos_ia`:
   * Campos: `usuario_id`, `canal_entrada` ('VOZ' o 'TEXTO'), `comando_transcrito`, `intencion_reconocida`, `payload_json` y `ejecutado_con_exito`[cite: 7].
3. Ejecutar la mutación en la base de datos y emitir el cambio por WebSockets para que el lienzo de todos los ingenieros se actualice instantáneamente sin recargar la página[cite: 7].

## 4. Criterios de Aceptación
* Modificación correcta de clases y relaciones mediante órdenes de voz sin usar ratón ni teclado[cite: 7].
* Trazabilidad completa de cada orden registrada en `auditoria_comandos_ia`[cite: 7].