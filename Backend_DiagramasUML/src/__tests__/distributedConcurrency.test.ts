import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { DistributedLockService } from '../services/DistributedLockService';

describe('Fase 5: Sincronización WebSockets y Exclusión Mutua Distribuida', () => {
  let user1Id: number;
  let user2Id: number;
  let projectId: number;
  let class1Id: number;
  let class2Id: number;

  beforeAll(async () => {
    await db.testConnection();

    // 1. Crear 2 usuarios ingenieros para pruebas de concurrencia
    const u1 = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ing. Roberto Carlos', $1, 'hashedpwd1', 'Ingeniero Senior A')
       RETURNING id`,
      [`roberto.${Date.now()}@uagrm.edu.bo`]
    );
    user1Id = Number(u1.rows[0].id);

    const u2 = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ing. Mariana Paz', $1, 'hashedpwd2', 'Ingeniera Senior B')
       RETURNING id`,
      [`mariana.${Date.now()}@uagrm.edu.bo`]
    );
    user2Id = Number(u2.rows[0].id);

    // 2. Crear proyecto
    const p = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ($1, 'Proyecto Concurrencia Distribuida', 'Testing Fase 5', $2)
       RETURNING id`,
      [`sala-concurrencia-${Date.now()}`, user1Id]
    );
    projectId = Number(p.rows[0].id);

    // 3. Crear clases UML de prueba
    const c1 = await db.query(
      `INSERT INTO uml_clases (proyecto_id, nombre, estereotipo, pos_x, pos_y)
       VALUES ($1, 'HistorialMedico', 'entity', 100, 100)
       RETURNING id`,
      [projectId]
    );
    class1Id = Number(c1.rows[0].id);

    const c2 = await db.query(
      `INSERT INTO uml_clases (proyecto_id, nombre, estereotipo, pos_x, pos_y)
       VALUES ($1, 'RecetaElectronica', 'entity', 400, 100)
       RETURNING id`,
      [projectId]
    );
    class2Id = Number(c2.rows[0].id);
  });

  afterAll(async () => {
    if (projectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [projectId]);
    }
    if (user1Id) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [user1Id]);
    }
    if (user2Id) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [user2Id]);
    }
  });

  it('1. Debe registrar la sesión activa en sesiones_activas al conectarse un ingeniero', async () => {
    const sessionId = await DistributedLockService.registerSession(
      projectId,
      user1Id,
      'socket-test-user-1',
      '192.168.1.50'
    );

    expect(sessionId).toBeGreaterThan(0);

    const check = await db.query('SELECT * FROM sesiones_activas WHERE id = $1', [sessionId]);
    expect(check.rows[0].conectado).toBe(true);
    expect(check.rows[0].socket_id).toBe('socket-test-user-1');
  });

  it('2. Exclusión Mutua Distribuida: Ingeniero 1 adquiere lock sobre clase; Ingeniero 2 es rechazado', async () => {
    // Ingeniero 1 solicita lock
    const res1 = await DistributedLockService.acquireLock(projectId, class1Id, user1Id);
    expect(res1.success).toBe(true);
    expect(res1.lock).toBeDefined();
    expect(res1.lock?.userId).toBe(user1Id);
    expect(res1.lock?.userName).toBe('Ing. Roberto Carlos');

    // Ingeniero 2 compite concurrentemente por el mismo nodo
    const res2 = await DistributedLockService.acquireLock(projectId, class1Id, user2Id);
    expect(res2.success).toBe(false);
    expect(res2.lockedBy).toBeDefined();
    expect(res2.lockedBy?.userId).toBe(user1Id);
    expect(res2.lockedBy?.userName).toBe('Ing. Roberto Carlos');
  });

  it('3. Latido de Renovación (Heartbeat cada 2s): Extiende la expiración del lease en PostgreSQL', async () => {
    const locksBefore = await DistributedLockService.getActiveLocks(projectId);
    const lockClass1 = locksBefore.find((l) => l.classId === class1Id);
    expect(lockClass1).toBeDefined();
    const originalExpiry = new Date(lockClass1!.expiraEn).getTime();

    // Simular paso de 50ms y enviar latido
    await new Promise((r) => setTimeout(r, 50));
    const renewed = await DistributedLockService.renewHeartbeat(projectId, class1Id, user1Id);
    expect(renewed).toBe(true);

    const locksAfter = await DistributedLockService.getActiveLocks(projectId);
    const renewedLock = locksAfter.find((l) => l.classId === class1Id);
    const newExpiry = new Date(renewedLock!.expiraEn).getTime();

    expect(newExpiry).toBeGreaterThanOrEqual(originalExpiry);
  });

  it('4. Liberación de Lock: Permite que el segundo ingeniero tome inmediatamente el nodo', async () => {
    // Ingeniero 1 libera el lock
    const released = await DistributedLockService.releaseLock(projectId, class1Id, user1Id);
    expect(released).toBe(true);

    // Ingeniero 2 solicita el lock libre
    const res2 = await DistributedLockService.acquireLock(projectId, class1Id, user2Id);
    expect(res2.success).toBe(true);
    expect(res2.lock?.userId).toBe(user2Id);
    expect(res2.lock?.userName).toBe('Ing. Mariana Paz');
  });

  it('5. Recuperación ante Desconexión: Limpia automáticamente los locks del usuario desconectado', async () => {
    // Ingeniero 2 adquiere también class2Id
    await DistributedLockService.acquireLock(projectId, class2Id, user2Id);

    const activeLocks = await DistributedLockService.getActiveLocks(projectId);
    expect(activeLocks.length).toBe(2);

    // Ingeniero 2 sufre corte de red inesperado
    await DistributedLockService.closeSession('socket-test-user-2');
    const releasedIds = await DistributedLockService.releaseAllUserLocks(projectId, user2Id);

    expect(releasedIds).toContain(class1Id);
    expect(releasedIds).toContain(class2Id);

    const remainingLocks = await DistributedLockService.getActiveLocks(projectId);
    expect(remainingLocks.length).toBe(0);
  });

  it('6. Purga de Locks Vencidos (Reaper de Arrendamiento): Elimina filas con expira_en <= NOW()', async () => {
    // Insertar un lock expirado manualmente en PostgreSQL
    await db.query(
      `INSERT INTO bloqueos_nodos (proyecto_id, clase_id, usuario_id, token_bloqueo, expira_en)
       VALUES ($1, $2, $3, 'token-expirado-test', CURRENT_TIMESTAMP - INTERVAL '1 second')`,
      [projectId, class1Id, user1Id]
    );

    const purged = await DistributedLockService.purgeExpiredLocks();
    expect(purged.some((p) => p.classId === class1Id)).toBe(true);

    // Verificar que la clase vuelve a estar completamente libre
    const res = await DistributedLockService.acquireLock(projectId, class1Id, user2Id);
    expect(res.success).toBe(true);
  });
});
