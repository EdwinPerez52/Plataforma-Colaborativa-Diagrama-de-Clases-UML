import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { AiCommandExecutionService } from '../services/AiCommandExecutionService';
import { AiNlpService } from '../services/AiNlpService';

describe('Fase 6: Asistente Inteligente de Edición por Voz y Lenguaje Natural (CU05)', () => {
  let userId: number;
  let projectId: number;

  beforeAll(async () => {
    await db.testConnection();

    // 1. Crear usuario ingeniero
    const u = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ing. Gabriela Mendoza', $1, 'hashedpass', 'Arquitecta de Software')
       RETURNING id`,
      [`gabriela.${Date.now()}@uagrm.edu.bo`]
    );
    userId = Number(u.rows[0].id);

    // 2. Crear proyecto
    const p = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ($1, 'Hospital Virtual AI', 'Proyecto Asistido por Voz', $2)
       RETURNING id`,
      [`sala-ai-${Date.now()}`, userId]
    );
    projectId = Number(p.rows[0].id);
  });

  afterAll(async () => {
    if (projectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [projectId]);
    }
    if (userId) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [userId]);
    }
  });

  it('1. NLP Parser: Debe mapear correctamente intenciones semánticas en lenguaje natural', () => {
    const cmd1 = AiNlpService.parseIntent('Crea la clase Paciente');
    expect(cmd1.intent).toBe('CREAR_CLASE');
    expect(cmd1.entities.className).toBe('Paciente');

    const cmd2 = AiNlpService.parseIntent('Añade a Paciente el atributo direccion tipo string');
    expect(cmd2.intent).toBe('AGREGAR_ATRIBUTO');
    expect(cmd2.entities.className).toBe('Paciente');
    expect(cmd2.entities.attributeName).toBe('direccion');
    expect(cmd2.entities.attributeType).toBe('String');

    const cmd3 = AiNlpService.parseIntent('Relaciona Medico con Consulta de 1 a muchos tipo composicion');
    expect(cmd3.intent).toBe('CREAR_RELACION');
    expect(cmd3.entities.className).toBe('Medico');
    expect(cmd3.entities.targetClassName).toBe('Consulta');
    expect(cmd3.entities.relationshipType).toBe('composition');
    expect(cmd3.entities.sourceMultiplicity).toBe('1..1');
    expect(cmd3.entities.targetMultiplicity).toBe('1..*');

    const cmd4 = AiNlpService.parseIntent('Elimina el atributo obsoleto en HistoriaClinica');
    expect(cmd4.intent).toBe('ELIMINAR_ATRIBUTO');
    expect(cmd4.entities.attributeName).toBe('obsoleto');
    expect(cmd4.entities.className).toBe('HistoriaClinica');
  });

  it('2. Ejecución de Voz: "Crea la clase Paciente" -> muta uml_clases y registra auditoría', async () => {
    const result = await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'VOZ',
      'Crea la clase Paciente'
    );

    expect(result.success).toBe(true);
    expect(result.parsedCommand.intent).toBe('CREAR_CLASE');
    expect(result.mutatedEntity?.type).toBe('CLASS');
    expect(result.mutatedEntity?.data.name).toBe('Paciente');

    // Verificar inserción en PostgreSQL
    const checkClass = await db.query(
      'SELECT * FROM uml_clases WHERE proyecto_id = $1 AND nombre = $2',
      [projectId, 'Paciente']
    );
    expect(checkClass.rowCount).toBe(1);

    // Verificar registro en auditoria_comandos_ia
    const checkAudit = await db.query(
      'SELECT * FROM auditoria_comandos_ia WHERE id = $1',
      [result.auditId]
    );
    expect(checkAudit.rowCount).toBe(1);
    expect(checkAudit.rows[0].canal_entrada).toBe('VOZ');
    expect(checkAudit.rows[0].intencion_reconocida).toBe('CREAR_CLASE');
    expect(checkAudit.rows[0].ejecutado_con_exito).toBe(true);
  });

  it('3. Ejecución de Texto: "Añade a Paciente el atributo direccion tipo string" -> muta uml_atributos', async () => {
    const result = await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'TEXTO',
      'Añade a Paciente el atributo direccion tipo string'
    );

    expect(result.success).toBe(true);
    expect(result.parsedCommand.intent).toBe('AGREGAR_ATRIBUTO');
    expect(result.mutatedEntity?.type).toBe('ATTRIBUTE');

    // Verificar en uml_atributos
    const checkAttr = await db.query(
      `SELECT a.* FROM uml_atributos a
       INNER JOIN uml_clases c ON c.id = a.clase_id
       WHERE c.proyecto_id = $1 AND a.nombre = $2`,
      [projectId, 'direccion']
    );
    expect(checkAttr.rowCount).toBe(1);
    expect(checkAttr.rows[0].tipo_dato).toBe('String');
  });

  it('4. Ejecución de Voz: "Crea la clase Consulta" y agregar método por comando', async () => {
    await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'VOZ',
      'Crea la clase Consulta'
    );

    const methodResult = await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'VOZ',
      'Añade el método cerrarConsulta a Consulta que retorna void'
    );

    expect(methodResult.success).toBe(true);
    expect(methodResult.parsedCommand.intent).toBe('AGREGAR_METODO');

    // Verificar en uml_metodos
    const checkMethod = await db.query(
      `SELECT m.* FROM uml_metodos m
       INNER JOIN uml_clases c ON c.id = m.clase_id
       WHERE c.proyecto_id = $1 AND m.nombre = $2`,
      [projectId, 'cerrarConsulta']
    );
    expect(checkMethod.rowCount).toBe(1);
    expect(checkMethod.rows[0].tipo_retorno).toBe('void');
  });

  it('5. Ejecución: "Relaciona Paciente con Consulta de 1 a muchos" -> muta uml_relaciones', async () => {
    const relResult = await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'VOZ',
      'Relaciona Paciente con Consulta de 1 a muchos'
    );

    expect(relResult.success).toBe(true);
    expect(relResult.parsedCommand.intent).toBe('CREAR_RELACION');
    expect(relResult.mutatedEntity?.type).toBe('RELATIONSHIP');

    // Verificar en uml_relaciones
    const checkRel = await db.query(
      'SELECT * FROM uml_relaciones WHERE proyecto_id = $1',
      [projectId]
    );
    expect(checkRel.rowCount).toBe(1);
    expect(checkRel.rows[0].multiplicidad_origen).toBe('1..1');
    expect(checkRel.rows[0].multiplicidad_destino).toBe('1..*');
  });

  it('6. Ejecución: "Elimina el atributo direccion en Paciente" -> borra fila en uml_atributos', async () => {
    const delResult = await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'TEXTO',
      'Elimina el atributo direccion en Paciente'
    );

    expect(delResult.success).toBe(true);
    expect(delResult.parsedCommand.intent).toBe('ELIMINAR_ATRIBUTO');

    const checkAttr = await db.query(
      `SELECT a.* FROM uml_atributos a
       INNER JOIN uml_clases c ON c.id = a.clase_id
       WHERE c.proyecto_id = $1 AND a.nombre = $2`,
      [projectId, 'direccion']
    );
    expect(checkAttr.rowCount).toBe(0);
  });

  it('7. Trazabilidad completa: getAuditHistory debe retornar la secuencia cronológica de órdenes IA', async () => {
    const audits = await AiCommandExecutionService.getAuditHistory(projectId);
    expect(audits.length).toBeGreaterThanOrEqual(5);

    const firstAudit = audits[audits.length - 1]; // Creación de Paciente
    expect(firstAudit.userName).toBe('Ing. Gabriela Mendoza');
    expect(firstAudit.channel).toBe('VOZ');
    expect(firstAudit.intent).toBe('CREAR_CLASE');
    expect(firstAudit.success).toBe(true);
  });

  it('8. Manejo de error y auditoría ante comando no reconocido', async () => {
    const badResult = await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'VOZ',
      'Hola como estas asistente que dia es hoy'
    );

    expect(badResult.success).toBe(false);
    expect(badResult.parsedCommand.intent).toBe('DESCONOCIDO');

    // Debe registrar la falla en auditoria_comandos_ia
    const checkAudit = await db.query(
      'SELECT * FROM auditoria_comandos_ia WHERE id = $1',
      [badResult.auditId]
    );
    expect(checkAudit.rows[0].ejecutado_con_exito).toBe(false);
    expect(checkAudit.rows[0].intencion_reconocida).toBe('DESCONOCIDO');
  });
});
