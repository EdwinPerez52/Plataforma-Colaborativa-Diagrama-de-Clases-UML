import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DiagramManager } from '../services/DiagramManager';
import { UmlClass, UmlRelationship } from '../types/uml';

describe('Fase 2: Metamodelo UML 2.5 y Persistencia Relacional Normalizada (13 Tablas)', () => {
  const migrationsPath = path.resolve(__dirname, '../../../database/migrations/001_full_schema.sql');
  const seedPath = path.resolve(__dirname, '../../../database/migrations/002_seed_data.sql');

  it('debe existir el script DDL oficial de migración 001_full_schema.sql', () => {
    expect(fs.existsSync(migrationsPath)).toBe(true);
    const content = fs.readFileSync(migrationsPath, 'utf-8');
    expect(content.length).toBeGreaterThan(500);
  });

  it('debe contener la definición exacta de las 13 tablas relacionales requeridas', () => {
    const sql = fs.readFileSync(migrationsPath, 'utf-8').toLowerCase();

    const expectedTables = [
      'usuarios',
      'proyectos',
      'proyecto_miembros',
      'sesiones_activas',
      'bloqueos_nodos',
      'uml_clases',
      'uml_atributos',
      'uml_metodos',
      'uml_metodo_parametros',
      'uml_relaciones',
      'snapshots_versiones',
      'auditoria_comandos_ia',
      'generaciones_backend',
    ];

    for (const table of expectedTables) {
      const regex = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?${table}\\s*\\(`, 'i');
      expect(regex.test(sql), `La tabla ${table} debe estar definida en el script DDL`).toBe(true);
    }
  });

  it('debe definir índices de rendimiento y cobertura para alta concurrencia', () => {
    const sql = fs.readFileSync(migrationsPath, 'utf-8').toLowerCase();

    const expectedIndices = [
      'idx_proyectos_codigo_sala',
      'idx_sesiones_proyecto',
      'idx_bloqueos_expiracion',
      'idx_uml_clases_proyecto',
      'idx_uml_atributos_clase',
      'idx_uml_relaciones_origen',
      'idx_uml_relaciones_destino',
      'idx_auditoria_ia_proyecto',
    ];

    for (const idx of expectedIndices) {
      expect(sql.includes(idx), `El índice ${idx} debe estar definido en el DDL`).toBe(true);
    }
  });

  it('debe contener el script de datos semilla 002_seed_data.sql con modelo del Sistema de Salud', () => {
    expect(fs.existsSync(seedPath)).toBe(true);
    const sql = fs.readFileSync(seedPath, 'utf-8');

    expect(sql.includes('Paciente')).toBe(true);
    expect(sql.includes('Medico')).toBe(true);
    expect(sql.includes('Consulta')).toBe(true);
    expect(sql.includes('sala-salud-2026-demo')).toBe(true);
  });

  it('debe transformar la topología UML a estructuras relacionales normalizadas para tablas intermedias N a N', () => {
    const dm = new DiagramManager();

    const doctor: UmlClass = {
      id: 'doc-1',
      name: 'Doctor',
      attributes: [{ id: 'a1', name: 'id', type: 'Long', visibility: '-', isPk: true }],
      methods: [],
      position: { x: 100, y: 100 },
    };

    const especialidad: UmlClass = {
      id: 'esp-1',
      name: 'Especialidad',
      attributes: [{ id: 'a2', name: 'id', type: 'Long', visibility: '-', isPk: true }],
      methods: [],
      position: { x: 400, y: 100 },
    };

    const roomId = 'test-room-phase2';
    dm.addClass(roomId, doctor);
    dm.addClass(roomId, especialidad);

    // Relación Muchos a Muchos (* a *)
    const relManyToMany: UmlRelationship = {
      id: 'rel-doc-esp',
      sourceClassId: 'doc-1',
      targetClassId: 'esp-1',
      type: 'association',
      sourceMultiplicity: '*',
      targetMultiplicity: '*',
      name: 'tiene_especialidades',
    };

    dm.addRelationship(roomId, relManyToMany);

    const diagram = dm.getDiagram(roomId);

    // Debe haberse generado la clase asociativa Doctor_Especialidad
    const intermediateClass = diagram.classes.find(c => c.name === 'Doctor_Especialidad');
    expect(intermediateClass).toBeDefined();
    expect(intermediateClass?.stereotype).toBe('intermediate_table');

    // La tabla intermedia debe tener PK y ambas FKs normalizadas
    const pk = intermediateClass?.attributes.find(a => a.isPk);
    const fk1 = intermediateClass?.attributes.find(a => a.name === 'doctor_id' && a.isFk);
    const fk2 = intermediateClass?.attributes.find(a => a.name === 'especialidad_id' && a.isFk);
    const auditAttr = intermediateClass?.attributes.find(a => a.name === 'fecha_registro');

    expect(pk).toBeDefined();
    expect(fk1).toBeDefined();
    expect(fk2).toBeDefined();
    expect(auditAttr).toBeDefined();

    // Deben existir dos relaciones de composición hacia la tabla intermedia
    const compRelations = diagram.relationships.filter(r => r.type === 'composition');
    expect(compRelations.length).toBe(2);
  });
});
