import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { VisionSketchService } from '../services/VisionSketchService';

describe('Fase 7: Módulo de Visión Computacional para Digitalización de Bocetos (CU06)', () => {
  let userId: number;
  let projectId: number;

  beforeAll(async () => {
    await db.testConnection();

    // 1. Crear usuario de prueba
    const u = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ing. Fernando Vaca', $1, 'passvision', 'Ingeniero de Visión')
       RETURNING id`,
      [`fernando.${Date.now()}@uagrm.edu.bo`]
    );
    userId = Number(u.rows[0].id);

    // 2. Crear proyecto
    const p = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ($1, 'Proyecto Digitalización Pizarra', 'Pruebas de Visión Fase 7', $2)
       RETURNING id`,
      [`sala-vision-${Date.now()}`, userId]
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

  it('1. Normalización de Tipos: Debe mapear tipos detectados en OCR a estándares UML', () => {
    expect(VisionSketchService.normalizeType('varchar')).toBe('String');
    expect(VisionSketchService.normalizeType('str')).toBe('String');
    expect(VisionSketchService.normalizeType('int')).toBe('Integer');
    expect(VisionSketchService.normalizeType('bigint')).toBe('Long');
    expect(VisionSketchService.normalizeType('bool')).toBe('Boolean');
    expect(VisionSketchService.normalizeType('date')).toBe('LocalDate');
    expect(VisionSketchService.normalizeType('datetime')).toBe('LocalDateTime');
    expect(VisionSketchService.normalizeType('decimal')).toBe('BigDecimal');
  });

  it('2. Pipeline de Detección: Debe segmentar 3 clases dibujadas a mano con sus coordenadas y atributos', async () => {
    // Simulación de carga fotográfica de pizarra
    const sampleImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await VisionSketchService.processSketch(projectId, sampleImageBase64);

    expect(result.success).toBe(true);
    expect(result.classesCount).toBe(3);
    expect(result.classes.length).toBe(3);

    // Verificar clases esperadas según criterio de aceptación
    const nombres = result.classes.map((c) => c.name);
    expect(nombres).toContain('Paciente');
    expect(nombres).toContain('ConsultaMedica');
    expect(nombres).toContain('Medico');

    // Verificar presencia de PK y atributos tipados
    const paciente = result.classes.find((c) => c.name === 'Paciente');
    expect(paciente).toBeDefined();
    expect(paciente?.attributes.some((a) => a.isPk && a.name === 'id')).toBe(true);

    // Verificar relaciones inferidas
    expect(result.relationships.length).toBeGreaterThanOrEqual(1);
    expect(result.pipelineMetrics.otsuBinarization).toBe(true);
  });

  it('3. Inyección y Persistencia: Debe insertar atómicamente clases, atributos y relaciones en PostgreSQL', async () => {
    const sampleImageBase64 = 'data:image/png;base64,sample';
    const preview = await VisionSketchService.processSketch(projectId, sampleImageBase64);

    const injection = await VisionSketchService.confirmAndInject(
      projectId,
      userId,
      preview.classes,
      preview.relationships
    );

    expect(injection.success).toBe(true);
    expect(injection.createdClasses.length).toBe(3);
    expect(injection.createdRelationships.length).toBeGreaterThanOrEqual(1);

    // 4. Verificar persistencia en uml_clases
    const dbClasses = await db.query(
      'SELECT * FROM uml_clases WHERE proyecto_id = $1 ORDER BY id ASC',
      [projectId]
    );
    expect(dbClasses.rowCount).toBe(3);

    // 5. Verificar persistencia en uml_atributos
    const dbAttrs = await db.query(
      `SELECT a.* FROM uml_atributos a
       INNER JOIN uml_clases c ON c.id = a.clase_id
       WHERE c.proyecto_id = $1`,
      [projectId]
    );
    expect(dbAttrs.rowCount).toBeGreaterThanOrEqual(9);

    // 6. Verificar persistencia en uml_relaciones
    const dbRels = await db.query(
      'SELECT * FROM uml_relaciones WHERE proyecto_id = $1',
      [projectId]
    );
    expect(dbRels.rowCount).toBeGreaterThanOrEqual(1);

    // 7. Verificar auditoría obligatoria en auditoria_comandos_ia (canal_entrada = 'FOTO_BOCETO')
    const checkAudit = await db.query(
      'SELECT * FROM auditoria_comandos_ia WHERE id = $1',
      [injection.auditId]
    );
    expect(checkAudit.rowCount).toBe(1);
    expect(checkAudit.rows[0].canal_entrada).toBe('FOTO_BOCETO');
    expect(checkAudit.rows[0].intencion_reconocida).toBe('DIGITALIZAR_BOCETO');
    expect(checkAudit.rows[0].ejecutado_con_exito).toBe(true);
  });
});
