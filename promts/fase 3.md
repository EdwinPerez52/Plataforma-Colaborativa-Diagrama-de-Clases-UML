# FASE 03: Autenticación Segura, Control de Acceso y Gestión de Salas de Modelado
**Metodología:** PUDS (Fase de Elaboración / Ciclo 1)[cite: 1, 3]  
**Materia:** Ingeniería de Software 1 — UAGRM[cite: 1, 6]  
**Proyecto:** Plataforma Web Colaborativa para el Modelado de Clases UML Asistido por IA y la Generación Automática de Backend Multicapa[cite: 6]  
**Documento Técnico:** `FASE_03_AUTENTICACION_Y_GESTION_SALAS.md`

---

## 1. Identificación y Objetivos de la Fase

### 1.1 Propósito
Construir e integrar la capa de seguridad, gestión de identidades y administración de salas de modelado colaborativo, garantizando la trazabilidad de acceso para los 20 ingenieros del equipo y preparando el ecosistema para la concurrencia distribuida en tiempo real sobre PostgreSQL[cite: 2, 7].

### 1.2 Casos de Uso Implementados al 100%
* `CU01: Autenticar usuario y gestionar sesión`: Registro de cuenta, inicio de sesión mediante credenciales seguras, expedición de tokens JWT criptográficos, validación de estado de cuenta y terminación segura de sesión.
* `CU02: Administrar proyectos y salas de trabajo`: Alta de proyectos con generación automática de identificadores de sala UUID v4, listado con control de acceso según pertenencia, persistencia atómica y eliminación lógica o física por el anfitrión.
* `CU03: Unirse a sala de modelado colaborativo`: Validación del código de sala, verificación de unicidad de membresía y asignación del rol de colaboración en base de datos.

---

## 2. Esquema Relacional Específico (PostgreSQL 15+)

La ejecución de esta fase opera de forma vinculante sobre las tablas de seguridad y membresía definidas en el modelo normalizado de 13 tablas:

```sql
-- 1. Tabla de Ingenieros / Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    cargo VARCHAR(80) DEFAULT 'Ingeniero de Software Senior',
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Proyectos y Salas de Modelado
CREATE TABLE IF NOT EXISTS proyectos (
    id BIGSERIAL PRIMARY KEY,
    codigo_sala VARCHAR(36) UNIQUE NOT NULL, -- UUID v4 expuesto para enlaces compartidos
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    propietario_id BIGINT NOT NULL,
    estado VARCHAR(20) DEFAULT 'EN_DISENO' CHECK (estado IN ('EN_DISENO', 'FINALIZADO', 'ARCHIVADO')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_proyectos_propietario FOREIGN KEY (propietario_id) 
        REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 3. Tabla Intermedia de Miembros y Roles en la Sala
CREATE TABLE IF NOT EXISTS proyecto_miembros (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    rol VARCHAR(20) DEFAULT 'EDITOR' CHECK (rol IN ('ANFITRION', 'EDITOR', 'OBSERVADOR')),
    unido_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_miembros_proyecto FOREIGN KEY (proyecto_id) 
        REFERENCES proyectos(id) ON DELETE CASCADE,
    CONSTRAINT fk_miembros_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT uk_proyecto_usuario UNIQUE (proyecto_id, usuario_id)
);

-- Índices de cobertura operativa para alta concurrencia
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_proyectos_codigo_sala ON proyectos(codigo_sala);
CREATE INDEX IF NOT EXISTS idx_proyecto_miembros_busqueda ON proyecto_miembros(usuario_id, proyecto_id);