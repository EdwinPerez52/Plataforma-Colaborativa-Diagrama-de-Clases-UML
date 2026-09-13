# FASE 02: Metamodelo UML 2.5 y Persistencia Relacional Normalizada (13 Tablas)
**Directiva para el Agente:** Implementación del DDL relacional en PostgreSQL y tipado estricto del grafo de clases UML.

---

## 1. Mapeo Atómico del Metamodelo UML
El sistema descarta el almacenamiento monolítico en un único campo JSON y normaliza cada componente del modelo para habilitar control de concurrencia y auditoría atómica[cite: 7]:
* Entidades estructurales: `uml_clases`, `uml_atributos`, `uml_metodos`, `uml_metodo_parametros` y `uml_relaciones`[cite: 7].
* Entidades de control y sesión: `usuarios`, `proyectos`, `proyecto_miembros`, `sesiones_activas` y `bloqueos_nodos`[cite: 1, 7].
* Entidades de trazabilidad: `snapshots_versiones`, `auditoria_comandos_ia` y `generaciones_backend`[cite: 7].

## 2. Script de Migración DDL en PostgreSQL (`database/migrations/001_full_schema.sql`)
```sql
-- MÓDULO 1: SEGURIDAD Y ACCESO
CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    cargo VARCHAR(80) DEFAULT 'Ingeniero de Software Senior',
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proyectos (
    id BIGSERIAL PRIMARY KEY,
    codigo_sala VARCHAR(36) UNIQUE NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    propietario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    estado VARCHAR(20) DEFAULT 'EN_DISENO',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proyecto_miembros (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol VARCHAR(20) DEFAULT 'EDITOR',
    unido_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_proyecto_usuario UNIQUE (proyecto_id, usuario_id)
);

-- MÓDULO 2: CONCURRENCIA Y EXCLUSIÓN MUTUA
CREATE TABLE sesiones_activas (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    socket_id VARCHAR(100) NOT NULL,
    ip_origen VARCHAR(45),
    ultimo_latido TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    conectado BOOLEAN DEFAULT TRUE
);

CREATE TABLE bloqueos_nodos (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    clase_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_bloqueo VARCHAR(64) NOT NULL,
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_bloqueo_nodo UNIQUE (proyecto_id, clase_id)
);

-- MÓDULO 3: GRAFO CONCEPTUAL UML 2.5
CREATE TABLE uml_clases (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    estereotipo VARCHAR(50) DEFAULT 'entity',
    es_abstracta BOOLEAN DEFAULT FALSE,
    pos_x INTEGER NOT NULL DEFAULT 100,
    pos_y INTEGER NOT NULL DEFAULT 100,
    ancho INTEGER NOT NULL DEFAULT 180,
    alto INTEGER NOT NULL DEFAULT 140,
    color_fondo VARCHAR(20) DEFAULT '#FFFFFF',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_nombre_clase_proyecto UNIQUE (proyecto_id, nombre)
);

CREATE TABLE uml_atributos (
    id BIGSERIAL PRIMARY KEY,
    clase_id BIGINT NOT NULL REFERENCES uml_clases(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    tipo_dato VARCHAR(50) NOT NULL,
    visibilidad VARCHAR(5) DEFAULT '-',
    es_clave_primaria BOOLEAN DEFAULT FALSE,
    es_nulo BOOLEAN DEFAULT TRUE,
    valor_defecto VARCHAR(100),
    orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE uml_metodos (
    id BIGSERIAL PRIMARY KEY,
    clase_id BIGINT NOT NULL REFERENCES uml_clases(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    tipo_retorno VARCHAR(50) DEFAULT 'void',
    visibilidad VARCHAR(5) DEFAULT '+',
    orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE uml_metodo_parametros (
    id BIGSERIAL PRIMARY KEY,
    metodo_id BIGINT NOT NULL REFERENCES uml_metodos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    tipo_dato VARCHAR(50) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE uml_relaciones (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    clase_origen_id BIGINT NOT NULL REFERENCES uml_clases(id) ON DELETE CASCADE,
    clase_destino_id BIGINT NOT NULL REFERENCES uml_clases(id) ON DELETE CASCADE,
    tipo_relacion VARCHAR(30) NOT NULL,
    multiplicidad_origen VARCHAR(10) NOT NULL DEFAULT '1..1',
    multiplicidad_destino VARCHAR(10) NOT NULL DEFAULT '1..*',
    nombre_relacion VARCHAR(100),
    es_bidireccional BOOLEAN DEFAULT FALSE
);

-- MÓDULO 4: AUDITORÍA, COMANDOS DE IA Y GENERACIÓN
CREATE TABLE snapshots_versiones (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    autor_id BIGINT NOT NULL REFERENCES usuarios(id),
    numero_version INTEGER NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    snapshot_completo JSONB NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_proyecto_version UNIQUE (proyecto_id, numero_version)
);

CREATE TABLE auditoria_comandos_ia (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    canal_entrada VARCHAR(20) NOT NULL,
    comando_transcrito TEXT NOT NULL,
    intencion_reconocida VARCHAR(50) NOT NULL,
    payload_json JSONB NOT NULL,
    ejecutado_con_exito BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generaciones_backend (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    version_spring_boot VARCHAR(20) DEFAULT '3.3.x',
    ruta_archivo_zip VARCHAR(255) NOT NULL,
    hash_sha256 VARCHAR(64) NOT NULL,
    descargas_conteo INTEGER DEFAULT 0,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES DE RENDIMIENTO PARA CONCURRENCIA
CREATE INDEX idx_proyectos_codigo_sala ON proyectos(codigo_sala);
CREATE INDEX idx_sesiones_proyecto ON sesiones_activas(proyecto_id, conectado);
CREATE INDEX idx_bloqueos_expiracion ON bloqueos_nodos(expira_en);
CREATE INDEX idx_uml_clases_proyecto ON uml_clases(proyecto_id);
CREATE INDEX idx_uml_atributos_clase ON uml_atributos(clase_id);
CREATE INDEX idx_uml_relaciones_origen ON uml_relaciones(clase_origen_id);
CREATE INDEX idx_uml_relaciones_destino ON uml_relaciones(clase_destino_id);
CREATE INDEX idx_auditoria_ia_proyecto ON auditoria_comandos_ia(proyecto_id);