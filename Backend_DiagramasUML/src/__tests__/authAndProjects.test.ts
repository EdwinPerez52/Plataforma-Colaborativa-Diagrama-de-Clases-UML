import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { AuthService } from '../services/AuthService';
import { ProjectService } from '../services/ProjectService';
import { AuthPayload } from '../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_case_collaborative_2026';

describe('Fase 3: Autenticación Segura, Control de Acceso y Gestión de Salas (CU01, CU02, CU03)', () => {
  const testEmail1 = `ingeniero.senior.${Date.now()}@uagrm.edu.bo`;
  const testEmail2 = `colaborador.${Date.now()}@uagrm.edu.bo`;
  let user1Id: number;
  let user2Id: number;
  let createdProjectId: number;
  let createdCodigoSala: string;

  beforeAll(async () => {
    // Asegurar que la conexión a la base de datos esté lista
    await db.testConnection();
  });

  afterAll(async () => {
    // Limpieza de datos de prueba
    if (createdProjectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [createdProjectId]);
    }
    if (user1Id) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [user1Id]);
    }
    if (user2Id) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [user2Id]);
    }
  });

  // -------------------------------------------------------------
  // CU01: Autenticar usuario y gestionar sesión
  // -------------------------------------------------------------
  describe('CU01: Autenticación y Gestión de Sesión', () => {
    it('debe registrar un nuevo usuario con contraseña hasheada y retornar token JWT', async () => {
      const result = await AuthService.register({
        nombre: 'Ing. Alejandro Vargas',
        email: testEmail1,
        password: 'PasswordSegura2026!',
        cargo: 'Arquitecto de Software',
      });

      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe(testEmail1.toLowerCase());
      expect(result.user.estado).toBe('ACTIVO');
      expect(result.token).toBeDefined();

      user1Id = result.user.id;

      // Verificar que el token decodificado tenga los claims correctos
      const decoded = jwt.verify(result.token, JWT_SECRET) as AuthPayload;
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe(testEmail1.toLowerCase());
    });

    it('debe rechazar el registro de un email duplicado con error 409', async () => {
      await expect(
        AuthService.register({
          nombre: 'Duplicado Test',
          email: testEmail1,
          password: 'OtraPassword123',
        })
      ).rejects.toThrow('El correo electrónico ya se encuentra registrado');
    });

    it('debe permitir iniciar sesión con credenciales correctas y expedir nuevo JWT', async () => {
      const loginRes = await AuthService.login({
        email: testEmail1,
        password: 'PasswordSegura2026!',
      });

      expect(loginRes.user.id).toBe(user1Id);
      expect(loginRes.token).toBeDefined();
    });

    it('debe rechazar credenciales con contraseña incorrecta (401)', async () => {
      await expect(
        AuthService.login({
          email: testEmail1,
          password: 'PasswordIncorrecta',
        })
      ).rejects.toThrow('Credenciales incorrectas');
    });

    it('debe bloquear el acceso si el estado de cuenta no es ACTIVO (403)', async () => {
      // Bloquear temporalmente el usuario
      await db.query("UPDATE usuarios SET estado = 'BLOQUEADO' WHERE id = $1", [user1Id]);

      await expect(
        AuthService.login({
          email: testEmail1,
          password: 'PasswordSegura2026!',
        })
      ).rejects.toThrow('Acceso denegado: Su cuenta se encuentra bloqueado');

      // Restaurar estado activo
      await db.query("UPDATE usuarios SET estado = 'ACTIVO' WHERE id = $1", [user1Id]);
    });
  });

  // -------------------------------------------------------------
  // CU02: Administrar proyectos y salas de trabajo
  // -------------------------------------------------------------
  describe('CU02: Gestión de Proyectos y Salas', () => {
    it('debe crear un proyecto, generar UUID v4 de sala y asignar rol ANFITRION al creador', async () => {
      const project = await ProjectService.createProject(user1Id, {
        titulo: 'Módulo de Facturación y Farmacia',
        descripcion: 'Modelado colaborativo del subsistema de farmacia hospitalaria',
      });

      expect(project.id).toBeDefined();
      expect(project.codigo_sala).toBeDefined();
      // Validar formato UUID v4 (8-4-4-4-12 caracteres hexadecimales)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(project.codigo_sala)).toBe(true);

      expect(project.rol_usuario).toBe('ANFITRION');
      expect(project.estado).toBe('EN_DISENO');

      createdProjectId = project.id;
      createdCodigoSala = project.codigo_sala;
    });

    it('debe listar los proyectos del usuario incluyendo su rol y conteo de miembros', async () => {
      const projects = await ProjectService.getUserProjects(user1Id);
      expect(projects.length).toBeGreaterThanOrEqual(1);

      const found = projects.find((p) => p.id === createdProjectId);
      expect(found).toBeDefined();
      expect(found?.rol_usuario).toBe('ANFITRION');
      expect(found?.miembros_conteo).toBe(1);
    });

    it('debe obtener detalles del proyecto por su código de sala UUID v4', async () => {
      const details = await ProjectService.getProjectDetails(createdCodigoSala, user1Id);
      expect(details.project.id).toBe(createdProjectId);
      expect(details.members.length).toBe(1);
      expect(details.members[0].usuario_id).toBe(user1Id);
      expect(details.members[0].rol).toBe('ANFITRION');
    });
  });

  // -------------------------------------------------------------
  // CU03: Unirse a sala de modelado colaborativo
  // -------------------------------------------------------------
  describe('CU03: Unirse a Sala de Modelado Colaborativo', () => {
    it('debe registrar a un segundo usuario y permitirle unirse a la sala con rol EDITOR', async () => {
      // Registrar usuario 2
      const reg2 = await AuthService.register({
        nombre: 'Ing. Elena Rostova',
        email: testEmail2,
        password: 'PasswordElena2026!',
        cargo: 'Ingeniera de Requerimientos',
      });
      user2Id = reg2.user.id;

      // Unirse a la sala creada por el usuario 1
      const joinResult = await ProjectService.joinProject(user2Id, createdCodigoSala, 'EDITOR');
      expect(joinResult.isNewMember).toBe(true);
      expect(joinResult.rol).toBe('EDITOR');
      expect(joinResult.project.id).toBe(createdProjectId);

      // Verificar que ahora la sala tiene 2 miembros
      const details = await ProjectService.getProjectDetails(createdProjectId);
      expect(details.members.length).toBe(2);
      const member2 = details.members.find((m) => m.usuario_id === user2Id);
      expect(member2).toBeDefined();
      expect(member2?.rol).toBe('EDITOR');
    });

    it('debe manejar membresía repetida de forma idempotente sin error de clave duplicada', async () => {
      const joinResult = await ProjectService.joinProject(user2Id, createdCodigoSala);
      expect(joinResult.isNewMember).toBe(false);
      expect(joinResult.rol).toBe('EDITOR');
    });

    it('solo el ANFITRION puede actualizar o archivar el proyecto', async () => {
      // Usuario 2 (EDITOR) intenta actualizar -> Debe fallar con error 403
      await expect(
        ProjectService.updateProject(createdProjectId, user2Id, {
          estado: 'FINALIZADO',
        })
      ).rejects.toThrow('Solo el anfitrión del proyecto puede realizar esta acción');

      // Usuario 1 (ANFITRION) actualiza -> Debe tener éxito
      const updated = await ProjectService.updateProject(createdProjectId, user1Id, {
        estado: 'FINALIZADO',
        titulo: 'Módulo de Facturación y Farmacia - Fase 1 Finalizada',
      });

      expect(updated.estado).toBe('FINALIZADO');
      expect(updated.titulo).toContain('Fase 1 Finalizada');
    });
  });
});
