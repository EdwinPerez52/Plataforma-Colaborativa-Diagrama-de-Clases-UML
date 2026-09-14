import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { UmlAtomicService } from '../services/UmlAtomicService';
import { UmlClass, UmlAttribute, UmlMethod, UmlRelationship } from '../types/uml';

describe('Fase 4: Endpoints Atómicos de Persistencia UML en PostgreSQL', () => {
  let testUserId: number;
  let testProjectId: number;
  let class1: UmlClass;
  let class2: UmlClass;
  let attr1: UmlAttribute;
  let method1: UmlMethod;
  let rel1: UmlRelationship;

  beforeAll(async () => {
    await db.testConnection();

    // 1. Crear usuario de prueba
    const userRes = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ingeniero UML Test', $1, 'hashedpass123', 'Diseñador UML')
       RETURNING id`,
      [`uml_test_${Date.now()}@uagrm.edu.bo`]
    );
    testUserId = Number(userRes.rows[0].id);

    // 2. Crear proyecto de prueba
    const projRes = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ($1, 'Proyecto Test Fase 4 Canvas', 'Pruebas de persistencia atómica', $2)
       RETURNING id`,
      [`sala-fase4-${Date.now()}`, testUserId]
    );
    testProjectId = Number(projRes.rows[0].id);
  });

  afterAll(async () => {
    if (testProjectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [testProjectId]);
    }
    if (testUserId) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [testUserId]);
    }
  });

  it('1. Debe insertar una clase con sus coordenadas y atributos iniciales en uml_clases', async () => {
    class1 = await UmlAtomicService.createClass(testProjectId, {
      name: 'Paciente',
      stereotype: 'entity',
      isAbstract: false,
      posX: 120,
      posY: 180,
      width: 220,
      height: 180,
      attributes: [
        { name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
        { name: 'ci', type: 'String', visibility: '-', isPk: false, isNullable: false },
      ],
    });

    expect(class1.dbId).toBeDefined();
    expect(class1.name).toBe('Paciente');
    expect(class1.position.x).toBe(120);
    expect(class1.position.y).toBe(180);
    expect(class1.attributes.length).toBe(2);
    expect(class1.attributes[0].isPk).toBe(true);

    // Crear segunda clase para relaciones posteriores
    class2 = await UmlAtomicService.createClass(testProjectId, {
      name: 'ConsultaMedica',
      stereotype: 'entity',
      posX: 450,
      posY: 180,
      width: 220,
      height: 180,
    });

    expect(class2.dbId).toBeDefined();
    expect(class2.name).toBe('ConsultaMedica');
  });

  it('2. Debe actualizar las coordenadas pos_x, pos_y y dimensiones de una clase (Canvas drag & drop)', async () => {
    const updated = await UmlAtomicService.updateClass(class1.dbId!, {
      posX: 160,
      posY: 220,
      width: 240,
      height: 200,
    });

    expect(updated.position.x).toBe(160);
    expect(updated.position.y).toBe(220);
    expect(updated.dimensions?.width).toBe(240);
    expect(updated.dimensions?.height).toBe(200);
  });

  it('3. Debe insertar atómicamente un nuevo atributo en uml_atributos', async () => {
    attr1 = await UmlAtomicService.createAttribute(class1.dbId!, {
      name: 'historialClinico',
      type: 'String',
      visibility: '-',
      isPk: false,
      isNullable: true,
      defaultValue: 'REG-000',
    });

    expect(attr1.dbId).toBeDefined();
    expect(attr1.name).toBe('historialClinico');
    expect(attr1.type).toBe('String');
    expect(attr1.defaultValue).toBe('REG-000');
  });

  it('4. Debe actualizar un atributo existente', async () => {
    const updatedAttr = await UmlAtomicService.updateAttribute(attr1.dbId!, {
      name: 'codigoHistorial',
      type: 'VARCHAR(50)',
      isNullable: false,
    });

    expect(updatedAttr.name).toBe('codigoHistorial');
    expect(updatedAttr.type).toBe('VARCHAR(50)');
    expect(updatedAttr.isNullable).toBe(false);
  });

  it('5. Debe insertar atómicamente un nuevo método en uml_metodos', async () => {
    method1 = await UmlAtomicService.createMethod(class1.dbId!, {
      name: 'obtenerEdad',
      returnType: 'Integer',
      visibility: '+',
    });

    expect(method1.dbId).toBeDefined();
    expect(method1.name).toBe('obtenerEdad');
    expect(method1.returnType).toBe('Integer');
    expect(method1.visibility).toBe('+');
  });

  it('6. Debe actualizar un método existente', async () => {
    const updatedMethod = await UmlAtomicService.updateMethod(method1.dbId!, {
      name: 'calcularEdadExacta',
      returnType: 'int',
    });

    expect(updatedMethod.name).toBe('calcularEdadExacta');
    expect(updatedMethod.returnType).toBe('int');
  });

  it('7. Debe crear atómicamente una relación ortogonal entre dos clases en uml_relaciones', async () => {
    rel1 = await UmlAtomicService.createRelationship(testProjectId, {
      sourceClassId: class1.dbId!,
      targetClassId: class2.dbId!,
      type: 'composition',
      sourceMultiplicity: '1..1',
      targetMultiplicity: '0..*',
      name: 'tiene_consultas',
      isBidirectional: true,
    });

    expect(rel1.dbId).toBeDefined();
    expect(rel1.sourceClassId).toBe(String(class1.dbId));
    expect(rel1.targetClassId).toBe(String(class2.dbId));
    expect(rel1.type).toBe('composition');
    expect(rel1.sourceMultiplicity).toBe('1..1');
    expect(rel1.targetMultiplicity).toBe('0..*');
  });

  it('8. Debe actualizar los parámetros de la relación (multiplicidades y tipo)', async () => {
    const updatedRel = await UmlAtomicService.updateRelationship(rel1.dbId!, {
      type: 'aggregation',
      sourceMultiplicity: '1..1',
      targetMultiplicity: '1..*',
      name: 'asociado_a',
    });

    expect(updatedRel.type).toBe('aggregation');
    expect(updatedRel.targetMultiplicity).toBe('1..*');
    expect(updatedRel.name).toBe('asociado_a');
  });

  it('9. Debe obtener el diagrama completo normalizado con clases, atributos, métodos y relaciones', async () => {
    const diagram = await UmlAtomicService.getDiagram(testProjectId);

    expect(diagram).toBeDefined();
    expect(diagram?.classes.length).toBe(2);

    const paciente = diagram?.classes.find((c) => c.name === 'Paciente');
    expect(paciente).toBeDefined();
    expect(paciente?.attributes.some((a) => a.name === 'codigoHistorial')).toBe(true);
    expect(paciente?.methods.some((m) => m.name === 'calcularEdadExacta')).toBe(true);

    expect(diagram?.relationships.length).toBe(1);
    expect(diagram?.relationships[0].name).toBe('asociado_a');
  });

  it('10. Debe eliminar un método, un atributo y una relación de forma independiente', async () => {
    const delRel = await UmlAtomicService.deleteRelationship(rel1.dbId!);
    expect(delRel).toBe(true);

    const delMethod = await UmlAtomicService.deleteMethod(method1.dbId!);
    expect(delMethod).toBe(true);

    const delAttr = await UmlAtomicService.deleteAttribute(attr1.dbId!);
    expect(delAttr).toBe(true);
  });

  it('11. Debe eliminar una clase y propagar el borrado en cascada', async () => {
    const delClass = await UmlAtomicService.deleteClass(class2.dbId!);
    expect(delClass).toBe(true);

    const diagramAfter = await UmlAtomicService.getDiagram(testProjectId);
    expect(diagramAfter?.classes.length).toBe(1);
  });
});
