import { db } from '../config/database';
import crypto from 'crypto';

export interface ActiveLockInfo {
  id: number;
  projectId: number;
  classId: number;
  userId: number;
  userName: string;
  userEmail: string;
  userCargo: string;
  tokenBloqueo: string;
  expiraEn: string;
}

export class DistributedLockService {
  /**
   * Registra una sesión activa en sesiones_activas al conectarse por WebSockets
   */
  static async registerSession(
    projectId: number,
    userId: number,
    socketId: string,
    ipOrigen?: string
  ): Promise<number> {
    const res = await db.query(
      `INSERT INTO sesiones_activas (proyecto_id, usuario_id, socket_id, ip_origen, ultimo_latido, conectado)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, TRUE)
       RETURNING id`,
      [projectId, userId, socketId, ipOrigen || '127.0.0.1']
    );
    return Number(res.rows[0].id);
  }

  /**
   * Cierra la sesión activa al desconectarse el socket
   */
  static async closeSession(socketId: string): Promise<void> {
    await db.query(
      `UPDATE sesiones_activas
       SET conectado = FALSE, ultimo_latido = CURRENT_TIMESTAMP
       WHERE socket_id = $1`,
      [socketId]
    );
  }

  /**
   * Intenta adquirir un bloqueo con arrendamiento (Lease: 5 segundos) sobre una clase UML
   * Garantiza CERO condiciones de carrera a nivel de PostgreSQL con transacción atómica
   */
  static async acquireLock(
    projectId: number,
    classId: number,
    userId: number
  ): Promise<{
    success: boolean;
    lock?: ActiveLockInfo;
    lockedBy?: ActiveLockInfo;
    renewed?: boolean;
  }> {
    return await db.transaction(async (client) => {
      // 1. Limpiar bloqueos expirados para esta clase si su tiempo ya venció
      await client.query(
        `DELETE FROM bloqueos_nodos
         WHERE proyecto_id = $1 AND clase_id = $2 AND expira_en <= CURRENT_TIMESTAMP`,
        [projectId, classId]
      );

      // 2. Consultar si existe un bloqueo activo
      const checkRes = await client.query(
        `SELECT b.id, b.proyecto_id, b.clase_id, b.usuario_id, b.token_bloqueo, b.expira_en,
                u.nombre AS user_name, u.email AS user_email, u.cargo AS user_cargo
         FROM bloqueos_nodos b
         INNER JOIN usuarios u ON u.id = b.usuario_id
         WHERE b.proyecto_id = $1 AND b.clase_id = $2 AND b.expira_en > CURRENT_TIMESTAMP
         FOR UPDATE`,
        [projectId, classId]
      );

      if (checkRes.rowCount && checkRes.rowCount > 0) {
        const row = checkRes.rows[0];
        if (Number(row.usuario_id) === userId) {
          // Renovación por el mismo usuario
          const renewRes = await client.query(
            `UPDATE bloqueos_nodos
             SET expira_en = CURRENT_TIMESTAMP + INTERVAL '5 seconds'
             WHERE id = $1
             RETURNING id, proyecto_id, clase_id, usuario_id, token_bloqueo, expira_en`,
            [row.id]
          );
          const rRow = renewRes.rows[0];
          return {
            success: true,
            renewed: true,
            lock: {
              id: Number(rRow.id),
              projectId: Number(rRow.proyecto_id),
              classId: Number(rRow.clase_id),
              userId: Number(rRow.usuario_id),
              userName: row.user_name,
              userEmail: row.user_email,
              userCargo: row.user_cargo,
              tokenBloqueo: rRow.token_bloqueo,
              expiraEn: rRow.expira_en.toISOString(),
            },
          };
        }

        // Bloqueado por otro usuario (Exclusión mutua activa)
        return {
          success: false,
          lockedBy: {
            id: Number(row.id),
            projectId: Number(row.proyecto_id),
            classId: Number(row.clase_id),
            userId: Number(row.usuario_id),
            userName: row.user_name,
            userEmail: row.user_email,
            userCargo: row.user_cargo,
            tokenBloqueo: row.token_bloqueo,
            expiraEn: row.expira_en.toISOString(),
          },
        };
      }

      // 3. Crear nuevo bloqueo con arrendamiento de 5 segundos
      const tokenBloqueo = crypto.randomBytes(24).toString('hex');
      const insertRes = await client.query(
        `INSERT INTO bloqueos_nodos (proyecto_id, clase_id, usuario_id, token_bloqueo, expira_en)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '5 seconds')
         RETURNING id, proyecto_id, clase_id, usuario_id, token_bloqueo, expira_en`,
        [projectId, classId, userId, tokenBloqueo]
      );

      const userRes = await client.query(
        'SELECT nombre, email, cargo FROM usuarios WHERE id = $1',
        [userId]
      );
      const u = userRes.rows[0];
      const iRow = insertRes.rows[0];

      return {
        success: true,
        renewed: false,
        lock: {
          id: Number(iRow.id),
          projectId: Number(iRow.proyecto_id),
          classId: Number(iRow.clase_id),
          userId: Number(iRow.usuario_id),
          userName: u.nombre,
          userEmail: u.email,
          userCargo: u.cargo,
          tokenBloqueo: iRow.token_bloqueo,
          expiraEn: iRow.expira_en.toISOString(),
        },
      };
    });
  }

  /**
   * Latido de renovación (Heartbeat cada 2s):
   * UPDATE bloqueos_nodos SET expira_en = NOW() + INTERVAL '5 seconds' WHERE clase_id = :id AND usuario_id = :uid
   */
  static async renewHeartbeat(
    projectId: number,
    classId: number,
    userId: number
  ): Promise<boolean> {
    const res = await db.query(
      `UPDATE bloqueos_nodos
       SET expira_en = CURRENT_TIMESTAMP + INTERVAL '5 seconds'
       WHERE proyecto_id = $1 AND clase_id = $2 AND usuario_id = $3 AND expira_en > CURRENT_TIMESTAMP
       RETURNING id`,
      [projectId, classId, userId]
    );

    // Actualizar latido en sesiones_activas
    await db.query(
      `UPDATE sesiones_activas
       SET ultimo_latido = CURRENT_TIMESTAMP
       WHERE usuario_id = $1 AND proyecto_id = $2 AND conectado = TRUE`,
      [userId, projectId]
    );

    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Libera atómicamente el bloqueo de un nodo
   */
  static async releaseLock(
    projectId: number,
    classId: number,
    userId: number
  ): Promise<boolean> {
    const res = await db.query(
      `DELETE FROM bloqueos_nodos
       WHERE proyecto_id = $1 AND clase_id = $2 AND usuario_id = $3
       RETURNING id`,
      [projectId, classId, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Libera todos los bloqueos asociados a un usuario en un proyecto (ej. al desconectarse)
   * Retorna los classIds liberados para difusión por WebSockets
   */
  static async releaseAllUserLocks(
    projectId: number,
    userId: number
  ): Promise<number[]> {
    const res = await db.query(
      `DELETE FROM bloqueos_nodos
       WHERE proyecto_id = $1 AND usuario_id = $2
       RETURNING clase_id`,
      [projectId, userId]
    );
    return res.rows.map((r: any) => Number(r.clase_id));
  }

  /**
   * Limpia todos los bloqueos vencidos en la base de datos (expira_en <= NOW())
   * Retorna lista de elementos liberados por timeout
   */
  static async purgeExpiredLocks(): Promise<Array<{ projectId: number; classId: number }>> {
    const res = await db.query(
      `DELETE FROM bloqueos_nodos
       WHERE expira_en <= CURRENT_TIMESTAMP
       RETURNING proyecto_id, clase_id`
    );
    return res.rows.map((r: any) => ({
      projectId: Number(r.proyecto_id),
      classId: Number(r.clase_id),
    }));
  }

  /**
   * Obtiene todos los bloqueos activos de un proyecto
   */
  static async getActiveLocks(projectId: number): Promise<ActiveLockInfo[]> {
    const res = await db.query(
      `SELECT b.id, b.proyecto_id, b.clase_id, b.usuario_id, b.token_bloqueo, b.expira_en,
              u.nombre AS user_name, u.email AS user_email, u.cargo AS user_cargo
       FROM bloqueos_nodos b
       INNER JOIN usuarios u ON u.id = b.usuario_id
       WHERE b.proyecto_id = $1 AND b.expira_en > CURRENT_TIMESTAMP
       ORDER BY b.id ASC`,
      [projectId]
    );

    return res.rows.map((row: any) => ({
      id: Number(row.id),
      projectId: Number(row.proyecto_id),
      classId: Number(row.clase_id),
      userId: Number(row.usuario_id),
      userName: row.user_name,
      userEmail: row.user_email,
      userCargo: row.user_cargo,
      tokenBloqueo: row.token_bloqueo,
      expiraEn: row.expira_en.toISOString(),
    }));
  }
}
