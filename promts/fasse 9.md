# FASE 09: Motor de Generación de Backend Spring Boot en 5 Capas y PostgreSQL
**Metodología:** PUDS (Fase de Construcción / Ciclo 2)[cite: 6, 7]  
**Materia:** Ingeniería de Software 1 — UAGRM[cite: 1, 6]  
**Proyecto:** Plataforma Web Colaborativa para el Modelado de Clases UML Asistido por IA y la Generación Automática de Backend Multicapa[cite: 6]  
**Documento Técnico:** `FASE_09_GENERADOR_SPRING_BOOT_5_CAPAS.md`

---

## 1. Identificación y Objetivos de la Fase

### 1.1 Propósito
Desarrollar e integrar el motor generador de código fuente que traduce automáticamente el grafo de clases UML modelado en una solución backend desacoplada, compilable y modular en **Java 17/21 con Spring Boot 3.x sobre PostgreSQL**, estructurada estrictamente bajo el **Patrón Arquitectónico de 5 Capas** (Entity, Repository, Service, Controller y DTO).

### 1.2 Justificación en Productividad (2do Desafío de la Materia)
En el contexto de la licitación del Sistema Nacional de Salud, los 20 ingenieros deben recortar el cronograma de **12 a 6 meses**. La automatización de la infraestructura de persistencia, operaciones CRUD, endpoints REST, validaciones y mapeos de datos elimina entre un **60% y 70% del tiempo de codificación manual repetitiva**, garantizando uniformidad en los estándares arquitectónicos de la empresa sin riesgo de discrepancias entre el diseño y la base de datos[cite: 4, 7].

### 1.3 Casos de Uso Implementados al 100%
* `CU08: Generar y descargar arquitectura backend Spring Boot (5 capas)`: Validación sintáctica del grafo de clases, compilación de plantillas de código, empaquetado del proyecto Maven en archivo ZIP, cálculo de integridad criptográfica y descarga directa para su ejecución en IDEs (IntelliJ IDEA, VS Code, Eclipse).

---

## 2. Entidades de Base de Datos Involucradas (PostgreSQL)

El motor consulta las tablas normalizadas del metamodelo UML para extraer la topología de datos y registra el artefacto binario generado en la tabla de auditoría de descargas:

```sql
-- 1. Extracción del Grafo Estructural
SELECT id, nombre, estereotipo, es_abstracta FROM uml_clases WHERE proyecto_id = :proyectoId;
SELECT id, clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_nulo, valor_defecto 
FROM uml_atributos WHERE clase_id IN (:clasesIds) ORDER BY orden ASC;
SELECT id, proyecto_id, clase_origen_id, clase_destino_id, tipo_relacion, 
       multiplicidad_origen, multiplicidad_destino, nombre_relacion, es_bidireccional 
FROM uml_relaciones WHERE proyecto_id = :proyectoId;

-- 2. Registro y Trazabilidad del ZIP Generado
INSERT INTO generaciones_backend (
    proyecto_id, usuario_id, version_spring_boot, ruta_archivo_zip, hash_sha256, descargas_conteo
) VALUES (
    :proyectoId, :usuarioId, '3.3.4', :rutaZip, :hashSha256, 0
) RETURNING id, creado_en;