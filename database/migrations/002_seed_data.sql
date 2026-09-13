-- ====================================================================
-- DATOS SEMILLA (SEED) PARA ENTORNO DE DESARROLLO Y PRUEBAS
-- PROYECTO: Plataforma Web Colaborativa CASE UML Asistida por IA
-- ====================================================================

-- 1. Ingeniero Líder / Anfitrión de Prueba (Password: 'admin123' hasheado con bcrypt)
INSERT INTO usuarios (id, nombre, email, password_hash, cargo, estado)
VALUES (
    1, 
    'Ing. Carlos Mendoza', 
    'carlos.mendoza@uagrm.edu.bo', 
    '$2b$10$EP0PkWtQ3p7xV5V0oJvX1.e2L5H.Y7lA8U7k4Z4z8Z4z8Z4z8Z4z8', 
    'Ingeniero de Software Senior', 
    'ACTIVO'
) ON CONFLICT (email) DO NOTHING;

-- 2. Proyecto de Ejemplo: Digitalización del Sistema Nacional de Salud
INSERT INTO proyectos (id, codigo_sala, titulo, descripcion, propietario_id, estado)
VALUES (
    1, 
    'sala-salud-2026-demo', 
    'Diagrama CASE UML', 
    'Modelado conceptual de clases para la plataforma colaborativa CASE UML.', 
    1, 
    'EN_DISENO'
) ON CONFLICT (codigo_sala) DO NOTHING;

-- 3. Membresía del Anfitrión
INSERT INTO proyecto_miembros (proyecto_id, usuario_id, rol)
VALUES (1, 1, 'ANFITRION')
ON CONFLICT (proyecto_id, usuario_id) DO NOTHING;

-- 4. Clases UML Iniciales
-- Clase 1: Paciente
INSERT INTO uml_clases (id, proyecto_id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto, color_fondo)
VALUES (1, 1, 'Paciente', 'entity', FALSE, 120, 100, 200, 180, '#FFFFFF')
ON CONFLICT (proyecto_id, nombre) DO NOTHING;

-- Atributos de Paciente
INSERT INTO uml_atributos (clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_nulo, orden)
VALUES 
(1, 'id', 'Long', '-', TRUE, FALSE, 1),
(1, 'ci', 'String', '-', FALSE, FALSE, 2),
(1, 'nombres', 'String', '-', FALSE, FALSE, 3),
(1, 'apellidos', 'String', '-', FALSE, FALSE, 4),
(1, 'fechaNacimiento', 'LocalDate', '-', FALSE, FALSE, 5),
(1, 'telefono', 'String', '-', FALSE, TRUE, 6)
ON CONFLICT DO NOTHING;

-- Métodos de Paciente
INSERT INTO uml_metodos (id, clase_id, nombre, tipo_retorno, visibilidad, orden)
VALUES 
(1, 1, 'obtenerEdad', 'Integer', '+', 1),
(2, 1, 'tieneHistorialPrevio', 'Boolean', '+', 2)
ON CONFLICT DO NOTHING;

-- Clase 2: Medico
INSERT INTO uml_clases (id, proyecto_id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto, color_fondo)
VALUES (2, 1, 'Medico', 'entity', FALSE, 480, 100, 200, 180, '#FFFFFF')
ON CONFLICT (proyecto_id, nombre) DO NOTHING;

-- Atributos de Medico
INSERT INTO uml_atributos (clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_nulo, orden)
VALUES 
(2, 'id', 'Long', '-', TRUE, FALSE, 1),
(2, 'matriculaProfesional', 'String', '-', FALSE, FALSE, 2),
(2, 'nombreCompleto', 'String', '-', FALSE, FALSE, 3),
(2, 'especialidad', 'String', '-', FALSE, FALSE, 4)
ON CONFLICT DO NOTHING;

-- Clase 3: Consulta
INSERT INTO uml_clases (id, proyecto_id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto, color_fondo)
VALUES (3, 1, 'Consulta', 'entity', FALSE, 300, 360, 220, 180, '#FFFFFF')
ON CONFLICT (proyecto_id, nombre) DO NOTHING;

-- Atributos de Consulta
INSERT INTO uml_atributos (clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_nulo, orden)
VALUES 
(3, 'id', 'Long', '-', TRUE, FALSE, 1),
(3, 'fechaHora', 'LocalDateTime', '-', FALSE, FALSE, 2),
(3, 'motivo', 'String', '-', FALSE, FALSE, 3),
(3, 'diagnostico', 'String', '-', FALSE, TRUE, 4),
(3, 'costo', 'Double', '-', FALSE, FALSE, 5)
ON CONFLICT DO NOTHING;

-- 5. Relaciones entre Clases
-- Paciente 1..1 --- 1..* Consulta (Composición)
INSERT INTO uml_relaciones (proyecto_id, clase_origen_id, clase_destino_id, tipo_relacion, multiplicidad_origen, multiplicidad_destino, nombre_relacion)
VALUES (1, 1, 3, 'COMPOSICION', '1..1', '1..*', 'tiene_consultas')
ON CONFLICT DO NOTHING;

-- Medico 1..1 --- 0..* Consulta (Asociación)
INSERT INTO uml_relaciones (proyecto_id, clase_origen_id, clase_destino_id, tipo_relacion, multiplicidad_origen, multiplicidad_destino, nombre_relacion)
VALUES (1, 2, 3, 'ASOCIACION', '1..1', '0..*', 'atiende_consultas')
ON CONFLICT DO NOTHING;

-- Ajustar los contadores de secuencia de Postgres
SELECT setval('usuarios_id_seq', (SELECT COALESCE(MAX(id), 1) FROM usuarios));
SELECT setval('proyectos_id_seq', (SELECT COALESCE(MAX(id), 1) FROM proyectos));
SELECT setval('uml_clases_id_seq', (SELECT COALESCE(MAX(id), 1) FROM uml_clases));
SELECT setval('uml_atributos_id_seq', (SELECT COALESCE(MAX(id), 1) FROM uml_atributos));
SELECT setval('uml_metodos_id_seq', (SELECT COALESCE(MAX(id), 1) FROM uml_metodos));
SELECT setval('uml_relaciones_id_seq', (SELECT COALESCE(MAX(id), 1) FROM uml_relaciones));
