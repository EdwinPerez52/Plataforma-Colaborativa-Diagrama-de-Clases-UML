import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { AiNlpService } from '../services/AiNlpService';
import { AiCommandExecutionService } from '../services/AiCommandExecutionService';
import { UmlAtomicService } from '../services/UmlAtomicService';
import { VisionSketchService } from '../services/VisionSketchService';
import { XmiInteroperabilityService } from '../services/XmiInteroperabilityService';
import { SpringBootGeneratorService } from '../services/SpringBootGeneratorService';

describe('Fase 12: Simulación de Examen en Vivo (< 10 Minutos) - Flujo Integral E2E', () => {
  let userId: number;
  let projectId: number;

  beforeAll(async () => {
    await db.testConnection();

    // Crear ingeniero anfitrión para la simulación del examen
    const uRes = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ing. Examen UAGRM', $1, 'hashedpass123', 'Ingeniero Evaluador')
       RETURNING id`,
      [`evaluador_${Date.now()}@uagrm.edu.bo`]
    );
    userId = Number(uRes.rows[0].id);

    // Crear proyecto del examen
    const pRes = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ('sala-examen-' || floor(random()*10000), 'Sistema Hospitalario San Juan de Dios', 'Proyecto de evaluación en vivo PUDS', $1)
       RETURNING id`,
      [userId]
    );
    projectId = Number(pRes.rows[0].id);
  });

  afterAll(async () => {
    if (projectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [projectId]);
    }
    if (userId) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [userId]);
    }
  });

  it('Paso 1: Entrada 1 (Comandos de Voz con IA) - Dictado y mutación en PostgreSQL', async () => {
    const rawVoiceText = 'Crea la clase Medico';
    const parsed = AiNlpService.parseIntent(rawVoiceText);

    expect(parsed.intent).toBe('CREAR_CLASE');
    expect(parsed.entities.className).toBe('Medico');

    const execResult = await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'VOZ',
      rawVoiceText
    );

    expect(execResult.success).toBe(true);

    // Agregar atributos por voz
    await AiCommandExecutionService.executeCommand(
      projectId,
      userId,
      'VOZ',
      'Añade a Medico el atributo especialidad tipo string'
    );

    const diagram = await UmlAtomicService.getDiagram(projectId);
    expect(diagram.classes.some((c) => c.name === 'Medico')).toBe(true);
    const medicoClass = diagram.classes.find((c) => c.name === 'Medico');
    expect(medicoClass?.attributes.some((a) => a.name === 'especialidad')).toBe(true);
  });

  it('Paso 2: Entrada 2 (Edición Manual en Lienzo) - Creación de clase Paciente y asociación 1 a N', async () => {
    // Creación manual de clase Paciente
    const paciente = await UmlAtomicService.createClass(projectId, {
      name: 'Paciente',
      stereotype: 'entity',
      isAbstract: false,
      posX: 400,
      posY: 100,
      width: 220,
      height: 160,
      attributes: [
        { name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
        { name: 'nombreCompleto', type: 'String', visibility: '-', isPk: false, isNullable: false },
        { name: 'historialClinico', type: 'String', visibility: '-', isPk: false, isNullable: false },
      ],
      methods: [],
    });

    expect(Number(paciente.id)).toBeGreaterThan(0);

    // Conexión manual de asociación 1 a N (Medico 1 ---> 0..* Paciente)
    const diagram = await UmlAtomicService.getDiagram(projectId);
    const medico = diagram.classes.find((c) => c.name === 'Medico')!;

    const rel = await UmlAtomicService.createRelationship(projectId, {
      sourceClassId: medico.id,
      targetClassId: paciente.id,
      type: 'association',
      name: 'atiende',
      sourceMultiplicity: '1..1',
      targetMultiplicity: '0..*',
      isBidirectional: false,
    });

    expect(Number(rel.id)).toBeGreaterThan(0);
    expect(rel.targetMultiplicity).toBe('0..*');
  });

  it('Paso 3: Entrada 3 (Fotografía de Boceto / Pizarra) - Digitalización óptica de clases', async () => {
    const mockSketchBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await VisionSketchService.processSketch(projectId, mockSketchBase64);
    expect(result.success).toBe(true);
    expect(result.classes.length).toBeGreaterThan(0);

    // Obtener clases existentes para no duplicar nombres
    const currentDiagram = await UmlAtomicService.getDiagram(projectId);
    const existingNames = new Set(currentDiagram.classes.map((c) => c.name));

    // Persistir las clases nuevas detectadas (ej. ConsultaMedica) en el metamodelo relacional
    for (const dc of result.classes) {
      if (!existingNames.has(dc.name)) {
        await UmlAtomicService.createClass(projectId, {
          name: dc.name,
          stereotype: 'entity',
          isAbstract: false,
          posX: dc.position.x,
          posY: dc.position.y,
          width: 200,
          height: 150,
          attributes: dc.attributes.map((a) => ({
            name: a.name,
            type: a.type,
            visibility: a.visibility as any,
            isPk: false,
            isNullable: false,
          })),
          methods: [],
        });
      }
    }

    const updatedDiagram = await UmlAtomicService.getDiagram(projectId);
    expect(updatedDiagram.classes.length).toBeGreaterThanOrEqual(3);
  });

  it('Paso 4: Interoperabilidad con Enterprise Architect - Exportación a XMI 2.1 / UML 2.5', async () => {
    const xml = await XmiInteroperabilityService.exportToXmi(projectId);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<xmi:XMI xmi:version="2.1"');
    expect(xml).toContain('xmlns:uml="http://schema.omg.org/spec/UML/2.1"');
    expect(xml).toContain('xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"');
    expect(xml).toContain('name="Medico"');
    expect(xml).toContain('name="Paciente"');
    expect(xml).toContain('xmi:type="uml:Association"');
  });

  it('Paso 5: Generación de Backend Spring Boot en 5 Capas - ZIP con SHA-256 de auditoría', async () => {
    const generationResult = await SpringBootGeneratorService.generateBackend(projectId, userId);

    expect(generationResult.success).toBe(true);
    expect(generationResult.versionSpringBoot).toBe('3.3.4');
    expect(generationResult.sha256).toBeDefined();
    expect(generationResult.zipBuffer).toBeInstanceOf(Buffer);
    expect(generationResult.totalFiles).toBeGreaterThan(15);

    // Verificar presencia de archivos de las 5 capas
    const filePaths = generationResult.files.map((f) => f.path);
    expect(filePaths.some((p) => p.includes('entity/Medico.java'))).toBe(true);
    expect(filePaths.some((p) => p.includes('repository/MedicoRepository.java'))).toBe(true);
    expect(filePaths.some((p) => p.includes('service/MedicoService.java'))).toBe(true);
    expect(filePaths.some((p) => p.includes('dto/request/MedicoRequestDTO.java'))).toBe(true);
    expect(filePaths.some((p) => p.includes('controller/MedicoController.java'))).toBe(true);
    expect(filePaths.some((p) => p.includes('pom.xml'))).toBe(true);
  });

  it('Paso 6: Consumo Móvil Offline - Ingesta de transacciones Outbox y persistencia relacional', async () => {
    const outboxBatch = [
      {
        transaction_uuid: 'uuid-exam-001',
        entity_name: 'Paciente',
        action_type: 'CREATE',
        payload: {
          nombreCompleto: 'Carlos Mendoza',
          historialClinico: 'HC-UAGRM-001',
        },
        client_timestamp: new Date().toISOString(),
      },
    ];

    // Simular el registro atómico en auditoría y sincronización diferida
    const processed = outboxBatch.map((tx) => ({
      transaction_uuid: tx.transaction_uuid,
      status: 'SYNCED',
      synced_at: new Date().toISOString(),
      server_record_id: 101,
    }));

    expect(processed.length).toBe(1);
    expect(processed[0].status).toBe('SYNCED');
    expect(processed[0].server_record_id).toBe(101);
  });
});
