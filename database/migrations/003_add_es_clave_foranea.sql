-- ====================================================================
-- MIGRACIÓN DDL: AÑADIR SOPORTE PARA CLAVE FORÁNEA (FK) EN ATRIBUTOS
-- PROYECTO: Plataforma Web Colaborativa CASE UML Asistida por IA
-- ====================================================================

ALTER TABLE uml_atributos ADD COLUMN IF NOT EXISTS es_clave_foranea BOOLEAN DEFAULT FALSE;
