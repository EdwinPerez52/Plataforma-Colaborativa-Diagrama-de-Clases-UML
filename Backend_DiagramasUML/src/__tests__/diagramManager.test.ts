import { describe, it, expect, beforeEach } from 'vitest';
import { DiagramManager } from '../services/DiagramManager';
import { UmlClass, UmlRelationship } from '../types/uml';

describe('DiagramManager - Evolución de Esquema y Tablas Intermedias N a N', () => {
  let diagramManager: DiagramManager;
  const roomId = 'test-room-diagram';

  const classPaciente: UmlClass = {
    id: 'class-paciente',
    name: 'Paciente',
    attributes: [
      { id: 'attr-1', name: 'id', type: 'Long', visibility: '+', isPk: true },
      { id: 'attr-2', name: 'nombre', type: 'String', visibility: '+', isNullable: false }
    ],
    methods: [],
    position: { x: 100, y: 100 }
  };

  const classMedico: UmlClass = {
    id: 'class-medico',
    name: 'Medico',
    attributes: [
      { id: 'attr-3', name: 'id', type: 'Long', visibility: '+', isPk: true },
      { id: 'attr-4', name: 'especialidad', type: 'String', visibility: '+' }
    ],
    methods: [],
    position: { x: 500, y: 100 }
  };

  beforeEach(() => {
    diagramManager = new DiagramManager();
    diagramManager.addClass(roomId, classPaciente);
    diagramManager.addClass(roomId, classMedico);
  });

  it('debe agregar y actualizar clases correctamente', () => {
    const diagram = diagramManager.getDiagram(roomId);
    expect(diagram.classes.length).toBe(2);
    expect(diagram.classes.find(c => c.name === 'Paciente')).toBeDefined();

    // Actualizar clase
    const updated = {
      ...classPaciente,
      attributes: [
        ...classPaciente.attributes,
        { id: 'attr-5', name: 'email', type: 'String', visibility: '+' as const }
      ]
    };
    const updateRes = diagramManager.updateClass(roomId, updated);
    expect(updateRes.updatedClass?.attributes.length).toBe(3);
  });

  it('debe agregar relación 1 a Muchos sin crear tabla intermedia', () => {
    const rel1ToN: UmlRelationship = {
      id: 'rel-1-n',
      sourceClassId: 'class-medico',
      targetClassId: 'class-paciente',
      type: 'association',
      sourceMultiplicity: '1',
      targetMultiplicity: '*'
    };

    const result = diagramManager.addRelationship(roomId, rel1ToN);
    expect(result.createdIntermediateClass).toBeUndefined();
    expect(result.diagram.relationships.length).toBe(1);
    expect(result.diagram.classes.length).toBe(2);
  });

  it('debe generar automáticamente una tabla intermedia cuando la cardinalidad es de Muchos a Muchos (* a *)', () => {
    const relManyToMany: UmlRelationship = {
      id: 'rel-n-n',
      sourceClassId: 'class-paciente',
      targetClassId: 'class-medico',
      type: 'association',
      sourceMultiplicity: '*',
      targetMultiplicity: '*'
    };

    const result = diagramManager.addRelationship(roomId, relManyToMany);

    // Debe haberse creado la clase intermedia
    expect(result.createdIntermediateClass).toBeDefined();
    expect(result.createdIntermediateClass?.name).toBe('Paciente_Medico');
    expect(result.createdIntermediateClass?.stereotype).toBe('intermediate_table');

    // Debe contener ID primario y las dos claves foráneas
    const attrs = result.createdIntermediateClass?.attributes || [];
    const pk = attrs.find(a => a.isPk);
    const fkPaciente = attrs.find(a => a.name === 'paciente_id' && a.isFk);
    const fkMedico = attrs.find(a => a.name === 'medico_id' && a.isFk);
    const fecha = attrs.find(a => a.name === 'fecha_registro');

    expect(pk).toBeDefined();
    expect(fkPaciente).toBeDefined();
    expect(fkMedico).toBeDefined();
    expect(fecha).toBeDefined();

    // El diagrama debe tener ahora 3 clases (Paciente, Medico, Paciente_Medico)
    expect(result.diagram.classes.length).toBe(3);

    // Deben haberse creado las 2 relaciones 1 a N hacia la tabla intermedia
    expect(result.createdRelationships?.length).toBe(2);
  });

  it('debe actualizar una relación existente de 1-N a N-N y generar la tabla intermedia dinámicamente', () => {
    // Primero agregar como 1 a N
    const rel: UmlRelationship = {
      id: 'rel-dinamica',
      sourceClassId: 'class-paciente',
      targetClassId: 'class-medico',
      type: 'association',
      sourceMultiplicity: '1',
      targetMultiplicity: '*'
    };
    diagramManager.addRelationship(roomId, rel);
    expect(diagramManager.getDiagram(roomId).classes.length).toBe(2);

    // El usuario edita la relación y la cambia a N a N (* a *)
    const updatedRel: UmlRelationship = {
      ...rel,
      sourceMultiplicity: '*',
      targetMultiplicity: '*'
    };

    const updateRes = diagramManager.updateRelationship(roomId, updatedRel);
    expect(updateRes.createdIntermediateClass).toBeDefined();
    expect(updateRes.createdIntermediateClass?.name).toBe('Paciente_Medico');
    expect(updateRes.diagram.classes.length).toBe(3);
  });

  it('debe revertir y eliminar la tabla intermedia si se cambia de N-N de vuelta a 1-N', () => {
    // Crear relación N a N
    const rel: UmlRelationship = {
      id: 'rel-revertir',
      sourceClassId: 'class-paciente',
      targetClassId: 'class-medico',
      type: 'association',
      sourceMultiplicity: '*',
      targetMultiplicity: '*'
    };
    const created = diagramManager.addRelationship(roomId, rel);
    expect(created.diagram.classes.length).toBe(3);
    const intermediateId = created.createdIntermediateClass?.id;

    // Cambiar a 1 a 1
    const revertedRel: UmlRelationship = {
      ...rel,
      intermediateTableId: intermediateId,
      sourceMultiplicity: '1',
      targetMultiplicity: '1'
    };

    const revertRes = diagramManager.updateRelationship(roomId, revertedRel);
    expect(revertRes.removedIntermediateClassId).toBe(intermediateId);
    expect(revertRes.diagram.classes.length).toBe(2);
  });
});
