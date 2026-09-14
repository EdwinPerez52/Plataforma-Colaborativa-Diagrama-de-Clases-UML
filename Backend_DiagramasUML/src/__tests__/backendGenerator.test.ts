import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { UmlAtomicService } from '../services/UmlAtomicService';
import { SpringBootGeneratorService } from '../services/SpringBootGeneratorService';
import JSZip from 'jszip';
import crypto from 'crypto';
import fs from 'fs';

describe('Fase 9: Motor de Generación de Backend Spring Boot en 5 Capas y PostgreSQL (CU08)', () => {
  let testUserId: number;
  let testProjectId: number;

  beforeAll(async () => {
    // 1. Crear usuario de prueba
    const userRes = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ingeniero Backend Test', $1, 'hashedpass123', 'Ingeniero de Software')
       RETURNING id`,
      [`backend_test_${Date.now()}@uagrm.edu.bo`]
    );
    testUserId = Number(userRes.rows[0].id);

    // 2. Crear proyecto de prueba
    const projRes = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ('sala-backend-' || floor(random()*10000), 'Sistema Nacional de Salud Digital', 'Proyecto piloto para generación de backend multicapa', $1)
       RETURNING id`,
      [testUserId]
    );
    testProjectId = Number(projRes.rows[0].id);

    // 3. Crear Clases UML
    // Clase 1: Paciente
    const c1 = await UmlAtomicService.createClass(testProjectId, {
      name: 'Paciente',
      stereotype: 'entity',
      isAbstract: false,
      posX: 100,
      posY: 100,
      width: 220,
      height: 180,
      attributes: [
        { name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
        { name: 'nombreCompleto', type: 'String', visibility: '-', isPk: false, isNullable: false },
        { name: 'documentoIdentidad', type: 'String', visibility: '-', isPk: false, isNullable: false },
        { name: 'fechaNacimiento', type: 'LocalDate', visibility: '-', isPk: false, isNullable: true },
        { name: 'activo', type: 'Boolean', visibility: '-', isPk: false, isNullable: false },
      ],
    });

    // Clase 2: ConsultaMedica
    const c2 = await UmlAtomicService.createClass(testProjectId, {
      name: 'ConsultaMedica',
      stereotype: 'entity',
      isAbstract: false,
      posX: 460,
      posY: 100,
      width: 230,
      height: 180,
      attributes: [
        { name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
        { name: 'motivo', type: 'String', visibility: '-', isPk: false, isNullable: false },
        { name: 'costo', type: 'BigDecimal', visibility: '-', isPk: false, isNullable: false },
        { name: 'fechaHora', type: 'LocalDateTime', visibility: '-', isPk: false, isNullable: false },
      ],
    });

    // Relación: Paciente 1..1 registra ConsultaMedica 0..*
    await UmlAtomicService.createRelationship(testProjectId, {
      sourceClassId: c1.id,
      targetClassId: c2.id,
      type: 'composition',
      sourceMultiplicity: '1..1',
      targetMultiplicity: '0..*',
      name: 'consultas',
      isBidirectional: true,
    });
  });

  afterAll(async () => {
    if (testProjectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [testProjectId]);
    }
    if (testUserId) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [testUserId]);
    }
  });

  it('1. Debe generar la arquitectura completa en 5 capas desacopladas', async () => {
    const result = await SpringBootGeneratorService.generateBackend(testProjectId, testUserId);

    expect(result.success).toBe(true);
    expect(result.versionSpringBoot).toBe('3.3.4');
    expect(result.totalFiles).toBeGreaterThanOrEqual(18); // pom, props, main, readme + 7 files per entity * 2 entities = 18
    expect(result.sha256).toHaveLength(64);

    // Verificar que el ZIP es legible y contiene los archivos
    const unzipped = await JSZip.loadAsync(result.zipBuffer);
    expect(unzipped.file('pom.xml')).toBeDefined();
    expect(unzipped.file('src/main/resources/application.properties')).toBeDefined();
    expect(unzipped.file('src/main/java/com/uagrm/casecase/CaseApplication.java')).toBeDefined();

    // Capa 1: Entities
    expect(unzipped.file('src/main/java/com/uagrm/casecase/entity/Paciente.java')).toBeDefined();
    expect(unzipped.file('src/main/java/com/uagrm/casecase/entity/ConsultaMedica.java')).toBeDefined();

    // Capa 2: Repositories
    expect(unzipped.file('src/main/java/com/uagrm/casecase/repository/PacienteRepository.java')).toBeDefined();
    expect(unzipped.file('src/main/java/com/uagrm/casecase/repository/ConsultaMedicaRepository.java')).toBeDefined();

    // Capa 3: Services (Interface & Impl)
    expect(unzipped.file('src/main/java/com/uagrm/casecase/service/PacienteService.java')).toBeDefined();
    expect(unzipped.file('src/main/java/com/uagrm/casecase/service/impl/PacienteServiceImpl.java')).toBeDefined();

    // Capa 4: DTOs (Request & Response)
    expect(unzipped.file('src/main/java/com/uagrm/casecase/dto/request/PacienteRequestDTO.java')).toBeDefined();
    expect(unzipped.file('src/main/java/com/uagrm/casecase/dto/response/PacienteResponseDTO.java')).toBeDefined();

    // Capa 5: Controllers
    expect(unzipped.file('src/main/java/com/uagrm/casecase/controller/PacienteController.java')).toBeDefined();
    expect(unzipped.file('src/main/java/com/uagrm/casecase/controller/ConsultaMedicaController.java')).toBeDefined();
  });

  it('2. Debe validar las anotaciones JPA, Lombok y validaciones Jakarta en el código generado', async () => {
    const result = await SpringBootGeneratorService.generateBackend(testProjectId, testUserId);
    const unzipped = await JSZip.loadAsync(result.zipBuffer);

    // Contenido de Paciente.java (Entity)
    const pacienteEntity = await unzipped.file('src/main/java/com/uagrm/casecase/entity/Paciente.java')!.async('text');
    expect(pacienteEntity).toContain('@Entity');
    expect(pacienteEntity).toContain('@Table(name = "pacientes")');
    expect(pacienteEntity).toContain('@Id');
    expect(pacienteEntity).toContain('@GeneratedValue(strategy = GenerationType.IDENTITY)');
    expect(pacienteEntity).toContain('private Long id;');
    expect(pacienteEntity).toContain('private String nombreCompleto;');
    expect(pacienteEntity).toContain('private LocalDate fechaNacimiento;');
    expect(pacienteEntity).toContain('@OneToMany');

    // Contenido de PacienteRepository.java (Spring Data JPA)
    const pacienteRepo = await unzipped.file('src/main/java/com/uagrm/casecase/repository/PacienteRepository.java')!.async('text');
    expect(pacienteRepo).toContain('@Repository');
    expect(pacienteRepo).toContain('extends JpaRepository<Paciente, Long>');

    // Contenido de PacienteServiceImpl.java (Service)
    const pacienteService = await unzipped.file('src/main/java/com/uagrm/casecase/service/impl/PacienteServiceImpl.java')!.async('text');
    expect(pacienteService).toContain('@Service');
    expect(pacienteService).toContain('@Transactional');
    expect(pacienteService).toContain('public List<PacienteResponseDTO> findAll()');
    expect(pacienteService).toContain('pacienteRepository.save(');

    // Contenido de PacienteRequestDTO.java (DTO)
    const pacienteRequest = await unzipped.file('src/main/java/com/uagrm/casecase/dto/request/PacienteRequestDTO.java')!.async('text');
    expect(pacienteRequest).toContain('@NotBlank');

    // Contenido de PacienteController.java (Controller)
    const pacienteController = await unzipped.file('src/main/java/com/uagrm/casecase/controller/PacienteController.java')!.async('text');
    expect(pacienteController).toContain('@RestController');
    expect(pacienteController).toContain('@RequestMapping("/api/v1/pacientes")');
    expect(pacienteController).toContain('@GetMapping');
    expect(pacienteController).toContain('@PostMapping');
    expect(pacienteController).toContain('@PutMapping');
    expect(pacienteController).toContain('@DeleteMapping');
  });

  it('3. Debe registrar la auditoría criptográfica en la tabla generaciones_backend', async () => {
    const result = await SpringBootGeneratorService.generateBackend(testProjectId, testUserId);

    const auditRes = await db.query(
      `SELECT id, proyecto_id, usuario_id, version_spring_boot, hash_sha256, descargas_conteo
       FROM generaciones_backend
       WHERE id = $1`,
      [result.generationId]
    );

    expect(auditRes.rowCount).toBe(1);
    const row = auditRes.rows[0];
    expect(Number(row.proyecto_id)).toBe(testProjectId);
    expect(Number(row.usuario_id)).toBe(testUserId);
    expect(row.version_spring_boot).toBe('3.3.4');
    expect(row.hash_sha256).toBe(result.sha256);
    expect(row.descargas_conteo).toBe(0);
  });
});
