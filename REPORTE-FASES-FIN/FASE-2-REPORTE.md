# Reporte de Fase 2: Metamodelo UML 2.5 y Persistencia Relacional Normalizada (13 Tablas en PostgreSQL)

**Fecha:** 9 de Septiembre de 2026  
**Estado:** ✅ **COMPLETADO (100% Tests Aprobados - Compilación Limpia)**  
**Proyecto:** Plataforma Web Colaborativa CASE UML Asistida por IA  
**Materia:** Ingeniería de Software 1 — UAGRM (FICCT)  
**Metodología:** PUDS (Fase de Elaboración / Ciclo 1)  

---

## 1. Resumen Ejecutivo de la Fase 2

En esta fase se ha construido la infraestructura de persistencia relacional que reemplaza cualquier almacenamiento monolítico no estructurado por un **esquema formal y normalizado de 13 tablas en PostgreSQL 15+**, garantizando:
- Integridad referencial con borrado en cascada controlado (`ON DELETE CASCADE`).
- Control de concurrencia atómico para los 20 ingenieros de software (`bloqueos_nodos` y `sesiones_activas`).
- Mapeo exacto del grafo conceptual UML 2.5 (`uml_clases`, `uml_atributos`, `uml_metodos`, `uml_metodo_parametros`, `uml_relaciones`).
- Soporte para la evolución automática de esquemas N a N con tablas intermedias / clases asociativas normalizadas.
- Auditoría histórica inmutable (`snapshots_versiones`, `auditoria_comandos_ia` y `generaciones_backend`).

---

## 2. Catálogo de las 13 Tablas Normalizadas Implementadas

### Módulo 1: Seguridad, Usuarios y Control de Acceso
1. `usuarios`: Credenciales de ingenieros (nombre, email único, password hash bcrypt, cargo, estado activo/bloqueado).
2. `proyectos`: Salas de modelado identificadas por `codigo_sala` (UUID v4), anfitrión y estado de diseño.
3. `proyecto_miembros`: Membresías y roles de acceso colaborativo (`ANFITRION`, `EDITOR`, `OBSERVADOR`).

### Módulo 2: Concurrencia y Exclusión Mutua
4. `sesiones_activas`: Seguimiento de presencia en tiempo real (socket_id, IP, latido y estado de conexión).
5. `bloqueos_nodos`: Candados semafóricos sobre entidades UML con token de arrendamiento (*lease*) y expiración temporal estricta.

### Módulo 3: Grafo Conceptual UML 2.5
6. `uml_clases`: Nodos conceptuales (nombre único por proyecto, estereotipo, abstracta, coordenadas `x, y`, dimensiones, color de fondo).
7. `uml_atributos`: Atributos tipados, visibilidad (`+ - # ~`), banderas `es_clave_primaria`, `es_nulo`, valor por defecto y orden.
8. `uml_metodos`: Operaciones de clase con visibilidad, tipo de retorno y orden.
9. `uml_metodo_parametros`: Parámetros tipados asociados a cada método.
10. `uml_relaciones`: Enlaces estructurales (asociación, agregación, composición, herencia), multiplicidades en origen/destino (`1..1`, `1..*`, `*`) y bidireccionalidad.

### Módulo 4: Auditoría, Comandos de IA y Generación
11. `snapshots_versiones`: Copias de seguridad atómicas del diagrama en formato JSONB con autor, fecha y número de versión incremental.
12. `auditoria_comandos_ia`: Registro inmutable de cada comando recibido por voz o texto, intención clasificada, payload y éxito de ejecución.
13. `generaciones_backend`: Historial de descargas de proyectos Spring Boot generados (hash SHA-256, ruta del ZIP, conteo de descargas).

---

## 3. Artefactos Desarrollados

| Archivo | Descripción |
|---|---|
| [`database/migrations/001_full_schema.sql`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/database/migrations/001_full_schema.sql) | Script DDL oficial con las 13 tablas, claves foráneas, restricciones de unicidad e índices. |
| [`database/migrations/002_seed_data.sql`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/database/migrations/002_seed_data.sql) | Datos semilla del caso de uso de salud (Paciente, Médico, Consulta y relaciones). |
| [`server/src/config/database.ts`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/server/src/config/database.ts) | Pool de conexiones PostgreSQL Hikari/pg con soporte para transacciones atómicas seguras. |
| [`server/src/database/migrator.ts`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/server/src/database/migrator.ts) | Script ejecutable de migraciones automáticas (`npm run migrate`). |
| [`server/src/types/uml.ts`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/server/src/types/uml.ts) | Tipado TypeScript estricto del metamodelo UML 2.5 alineado a la persistencia relacional. |
| [`server/src/repositories/UmlRepository.ts`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/server/src/repositories/UmlRepository.ts) | Repositorio de acceso a datos con sincronización transaccional del diagrama hacia las 13 tablas. |
| [`server/src/__tests__/metamodelPersistence.test.ts`](file:///C:/Users/jospe/Documents/1er%20Parcial%20Sw1/server/src/__tests__/metamodelPersistence.test.ts) | Pruebas automatizadas de integridad del esquema DDL y normalización N a N. |

---

## 4. Resultados de Pruebas Automatizadas

```bash
> case-collaborative-server@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/jospe/Documents/1er Parcial Sw1/server

 ✓ src/__tests__/diagramManager.test.ts (5 tests)
 ✓ src/__tests__/metamodelPersistence.test.ts (5 tests)
 ✓ src/__tests__/lockManager.test.ts (7 tests)
 ✓ src/__tests__/collaborationSocket.test.ts (5 tests)

 Test Files  4 passed (4)
      Tests  22 passed (22)
   Duration  1.54s
```

Compilación TypeScript: **`tsc` exitosa con cero errores.**
